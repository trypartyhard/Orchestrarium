use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Tracks suppression count and project watcher control.
pub struct WatcherState {
    pub suppression: Mutex<crate::state::WatcherSuppressionState>,
    /// Channel to send reconfigure commands to the project watcher thread.
    pub project_watcher_tx: Mutex<Option<std::sync::mpsc::Sender<Option<PathBuf>>>>,
}

fn emit_or_defer_refresh(watcher_state: &WatcherState, app: &AppHandle) {
    let should_emit = {
        let mut suppression = watcher_state.suppression.blocking_lock();
        if suppression.count > 0 {
            suppression.pending_refresh = true;
            false
        } else {
            true
        }
    };

    if should_emit {
        let _ = app.emit("fs-changed", ());
    }
}

/// Start watching ~/.claude/{agents,skills,commands} directories (global watcher).
/// Also spawns a project watcher thread that can be reconfigured dynamically.
/// Emits "fs-changed" event to frontend on external changes.
pub fn start_watcher(
    app: AppHandle,
    base_dir: PathBuf,
    watcher_state: Arc<WatcherState>,
) -> Result<(), String> {
    let sections = ["agents", "skills", "commands"];
    let mut dirs_to_watch: Vec<PathBuf> = Vec::new();

    for section in &sections {
        let dir = base_dir.join(section);
        // Ensure directory exists so watcher can monitor it from the start
        let _ = std::fs::create_dir_all(&dir);
        dirs_to_watch.push(dir);
    }

    // ─── Global watcher ─────────────────────────────────────────
    let (init_tx, init_rx) = std::sync::mpsc::channel();
    let ws_global = watcher_state.clone();
    let app_global = app.clone();

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut debouncer = match new_debouncer(Duration::from_millis(300), tx) {
            Ok(d) => { let _ = init_tx.send(Ok(())); d }
            Err(e) => { let _ = init_tx.send(Err(format!("Failed to create watcher: {}", e))); return; }
        };

        for dir in &dirs_to_watch {
            if let Err(e) = debouncer
                .watcher()
                .watch(dir, notify::RecursiveMode::Recursive)
            {
                eprintln!("Warning: failed to watch {}: {}", dir.display(), e);
            }
        }

        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    let has_md = events.iter().any(|e| {
                        matches!(e.kind, DebouncedEventKind::Any | DebouncedEventKind::AnyContinuous)
                            && e.path.extension().map_or(false, |ext| ext == "md")
                    });

                    if has_md {
                        emit_or_defer_refresh(&ws_global, &app_global);
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Warning: global watcher error: {:?}", e);
                }
                Err(_) => break,
            }
        }
    });

    match init_rx.recv() {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            eprintln!("Warning: global watcher failed to start: {}. Continuing without global auto-refresh.", e);
        }
        Err(_) => {
            eprintln!("Warning: global watcher thread failed to report status. Continuing without global auto-refresh.");
        }
    }

    // ─── Project watcher (dynamic, reconfigurable) ──────────────
    let (project_tx, project_rx) = std::sync::mpsc::channel::<Option<PathBuf>>();

    // Store the sender BEFORE spawning the thread so commands can use it immediately
    {
        let mut tx_lock = watcher_state.project_watcher_tx.blocking_lock();
        *tx_lock = Some(project_tx.clone());
    }

    let ws_project = watcher_state.clone();
    let app_project = app;

    std::thread::spawn(move || {
        let mut current_debouncer: Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>> = None;
        let mut current_event_rx: Option<std::sync::mpsc::Receiver<notify_debouncer_mini::DebounceEventResult>> = None;

        loop {
            // Check for reconfigure commands (non-blocking if we have an active watcher)
            let reconfig = if current_debouncer.is_some() {
                match project_rx.try_recv() {
                    Ok(cmd) => Some(cmd),
                    Err(std::sync::mpsc::TryRecvError::Empty) => None,
                    Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
                }
            } else {
                // No active watcher, block until we get a command
                match project_rx.recv() {
                    Ok(cmd) => Some(cmd),
                    Err(_) => break, // Channel closed
                }
            };

            if let Some(new_project) = reconfig {
                // Drop old watcher
                current_debouncer = None;
                current_event_rx = None;

                if let Some(project_root) = new_project {
                    let claude_dir = project_root.join(".claude");
                    let sections = ["agents", "skills", "commands"];
                    let (event_tx, event_rx) = std::sync::mpsc::channel();

                    match new_debouncer(Duration::from_millis(300), event_tx) {
                        Ok(mut debouncer) => {
                            for section in &sections {
                                let dir = claude_dir.join(section);
                                let _ = std::fs::create_dir_all(&dir);
                                if let Err(e) = debouncer.watcher().watch(&dir, notify::RecursiveMode::Recursive) {
                                    eprintln!("Warning: failed to watch project {}: {}", dir.display(), e);
                                }
                            }
                            current_event_rx = Some(event_rx);
                            current_debouncer = Some(debouncer);
                            let _ = app_project.emit("fs-changed", ());
                        }
                        Err(e) => {
                            eprintln!("Warning: failed to create project watcher: {}", e);
                        }
                    }
                }
                continue;
            }

            // Process file events from project watcher
            if let Some(event_rx) = current_event_rx.as_ref() {
                match event_rx.try_recv() {
                    Ok(Ok(events)) => {
                        let has_md = events.iter().any(|e| {
                            matches!(e.kind, DebouncedEventKind::Any | DebouncedEventKind::AnyContinuous)
                                && e.path.extension().map_or(false, |ext| ext == "md")
                        });

                        if has_md {
                            emit_or_defer_refresh(&ws_project, &app_project);
                        }
                    }
                    Ok(Err(e)) => {
                        eprintln!("Warning: project watcher error: {:?}", e);
                    }
                    Err(_) => {
                        // No events ready, sleep briefly to avoid busy loop
                        std::thread::sleep(Duration::from_millis(50));
                    }
                }
            }
        }
    });

    Ok(())
}
