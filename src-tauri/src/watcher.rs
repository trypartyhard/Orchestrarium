use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Tracks suppression count for self-initiated operations.
/// Events are suppressed when count > 0, allowing concurrent operations
/// without race conditions (unlike a simple boolean flag).
pub struct WatcherState {
    pub suppress_count: AtomicU32,
}

/// Start watching ~/.claude/{agents,skills,commands} directories.
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

    let (init_tx, init_rx) = std::sync::mpsc::channel();

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
                    // Skip if self-initiated operation in progress
                    if watcher_state.suppress_count.load(Ordering::SeqCst) > 0 {
                        continue;
                    }

                    // Check if any event involves .md files
                    let has_md = events.iter().any(|e| {
                        matches!(e.kind, DebouncedEventKind::Any | DebouncedEventKind::AnyContinuous)
                            && e.path
                                .extension()
                                .map_or(false, |ext| ext == "md")
                    });

                    if has_md {
                        let _ = app.emit("fs-changed", ());
                    }
                }
                Ok(Err(_)) => {} // Watch error, ignore
                Err(_) => break, // Channel closed
            }
        }
    });

    init_rx.recv().map_err(|_| "Watcher thread failed to start".to_string())?
}
