use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Tracks suppression count and project watcher control.
pub struct WatcherState {
    pub suppress_count: AtomicU32,
    /// Channel to send reconfigure commands to the project watcher thread.
    pub project_watcher_tx: Mutex<Option<std::sync::mpsc::Sender<Option<PathBuf>>>>,
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
                    if ws_global.suppress_count.load(Ordering::SeqCst) > 0 {
                        continue;
                    }

                    let has_md = events.iter().any(|e| {
                        matches!(e.kind, DebouncedEventKind::Any | DebouncedEventKind::AnyContinuous)
                            && e.path.extension().map_or(false, |ext| ext == "md")
                    });

                    if has_md {
                        let _ = app_global.emit("fs-changed", ());
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Warning: global watcher error: {:?}", e);
                }
                Err(_) => break,
            }
        }
    });

    init_rx.recv().map_err(|_| "Watcher thread failed to start".to_string())??;

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
        let (event_tx, event_rx) = std::sync::mpsc::channel();

        loop {
            // Check for reconfigure commands (non-blocking if we have an active watcher)
            let reconfig = if current_debouncer.is_some() {
                project_rx.try_recv().ok()
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

                if let Some(project_root) = new_project {
                    let claude_dir = project_root.join(".claude");
                    let sections = ["agents", "skills", "commands"];

                    // Create a new debouncer reusing the same event channel
                    let new_event_tx = event_tx.clone();
                    match new_debouncer(Duration::from_millis(300), new_event_tx) {
                        Ok(mut debouncer) => {
                            for section in &sections {
                                let dir = claude_dir.join(section);
                                let _ = std::fs::create_dir_all(&dir);
                                if let Err(e) = debouncer.watcher().watch(&dir, notify::RecursiveMode::Recursive) {
                                    eprintln!("Warning: failed to watch project {}: {}", dir.display(), e);
                                }
                            }
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
            if current_debouncer.is_some() {
                match event_rx.try_recv() {
                    Ok(Ok(events)) => {
                        if ws_project.suppress_count.load(Ordering::SeqCst) > 0 {
                            continue;
                        }
                        let has_md = events.iter().any(|e| {
                            matches!(e.kind, DebouncedEventKind::Any | DebouncedEventKind::AnyContinuous)
                                && e.path.extension().map_or(false, |ext| ext == "md")
                        });
                        if has_md {
                            let _ = app_project.emit("fs-changed", ());
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
