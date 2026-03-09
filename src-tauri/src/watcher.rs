use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Tracks whether a self-initiated toggle is in progress.
/// When true, watcher events are suppressed to prevent feedback loops.
pub struct WatcherState {
    pub suppressed: AtomicBool,
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
        if dir.exists() {
            dirs_to_watch.push(dir);
        }
    }

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut debouncer = new_debouncer(Duration::from_millis(300), tx)
            .map_err(|e| format!("Failed to create debouncer: {}", e))
            .unwrap();

        for dir in &dirs_to_watch {
            let _ = debouncer
                .watcher()
                .watch(dir, notify::RecursiveMode::Recursive);
        }

        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    // Skip if self-initiated toggle in progress
                    if watcher_state.suppressed.load(Ordering::SeqCst) {
                        continue;
                    }

                    // Check if any event involves .md files
                    let has_md = events.iter().any(|e| {
                        matches!(e.kind, DebouncedEventKind::Any)
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

    Ok(())
}
