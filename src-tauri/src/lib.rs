use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::Manager;

fn sanitize_input(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect()
}

#[tauri::command]
fn save_log(app_handle: tauri::AppHandle, date: String, content: String) -> Result<(), String> {
    let clean_date = sanitize_input(&date);
    if clean_date.is_empty() {
        return Err("Invalid date parameter".to_string());
    }
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    let file_path = logs_dir.join(format!("{}.txt", clean_date));

    // If file already exists and is being edited, preserve a timestamped backup copy on disk
    if file_path.exists() {
        let backups_dir = logs_dir.join("backups");
        let _ = fs::create_dir_all(&backups_dir);
        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let backup_path = backups_dir.join(format!("{}_{}.txt", clean_date, now_ts));
        let _ = fs::copy(&file_path, backup_path);
    }

    fs::write(file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_all_logs(app_handle: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    let mut logs = HashMap::new();
    
    if logs_dir.exists() {
        for entry in fs::read_dir(logs_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "txt") {
                if let Some(file_stem) = path.file_stem() {
                    let file_name = file_stem.to_string_lossy().into_owned();
                    if let Ok(content) = fs::read_to_string(&path) {
                        logs.insert(file_name, content);
                    }
                }
            }
        }
    }
    Ok(logs)
}

#[tauri::command]
fn delete_log(app_handle: tauri::AppHandle, date: String) -> Result<(), String> {
    let clean_date = sanitize_input(&date);
    if clean_date.is_empty() {
        return Ok(());
    }
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    let file_path = logs_dir.join(format!("{}.txt", clean_date));
    if file_path.exists() {
        let _ = fs::remove_file(file_path);
    }

    // Also remove any screenshot files associated with this date
    let prefix = format!("{}_img_", clean_date);
    let alt_prefix = format!("{}_", clean_date);
    if logs_dir.exists() {
        if let Ok(entries) = fs::read_dir(&logs_dir) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if (file_name.starts_with(&prefix) || file_name.starts_with(&alt_prefix)) && !file_name.ends_with(".txt") {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn get_log_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    Ok(logs_dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn save_screenshot(app_handle: tauri::AppHandle, date: String, filename: String, data_url: String) -> Result<(), String> {
    let clean_date = sanitize_input(&date);
    let clean_filename = sanitize_input(&filename);
    if clean_date.is_empty() || clean_filename.is_empty() {
        return Err("Invalid date or filename parameter".to_string());
    }

    let final_name = if clean_filename.starts_with("img_") {
        format!("{}_{}", clean_date, clean_filename)
    } else {
        format!("{}_img_{}", clean_date, clean_filename)
    };

    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    let file_path = logs_dir.join(final_name);
    fs::write(file_path, data_url).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_session_screenshots(app_handle: tauri::AppHandle, date: String) -> Result<Vec<HashMap<String, String>>, String> {
    let clean_date = sanitize_input(&date);
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    let mut screenshots = Vec::new();
    let prefix = format!("{}_img_", clean_date);
    let alt_prefix = format!("{}_", clean_date);
    
    if logs_dir.exists() {
        for entry in fs::read_dir(logs_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if (file_name.starts_with(&prefix) || file_name.starts_with(&alt_prefix)) && !file_name.ends_with(".txt") {
                        if let Ok(data_url) = fs::read_to_string(&path) {
                            let mut item = HashMap::new();
                            item.insert("filename".to_string(), file_name.to_string());
                            item.insert("dataUrl".to_string(), data_url);
                            screenshots.push(item);
                        }
                    }
                }
            }
        }
    }
    screenshots.sort_by(|a, b| a["filename"].cmp(&b["filename"]));
    Ok(screenshots)
}

#[tauri::command]
fn delete_screenshot(app_handle: tauri::AppHandle, filename: String) -> Result<(), String> {
    let clean_filename = sanitize_input(&filename);
    if clean_filename.is_empty() {
        return Ok(());
    }
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = app_dir.join("logs").join(clean_filename);
    if file_path.exists() {
        let _ = fs::remove_file(file_path);
    }
    Ok(())
}

#[tauri::command]
fn sync_local_directory(app_handle: tauri::AppHandle, target_dir: String) -> Result<(), String> {
    if target_dir.trim().is_empty() {
        return Ok(());
    }
    let dest_path = Path::new(&target_dir);
    if !dest_path.is_absolute() {
        return Err("Target directory must be an absolute path".to_string());
    }
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    if !logs_dir.exists() {
        return Ok(());
    }
    fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
    
    for entry in fs::read_dir(logs_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(file_name) = path.file_name() {
                let target_file = dest_path.join(file_name);
                let _ = fs::copy(&path, &target_file);
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            save_log,
            load_all_logs,
            delete_log,
            get_log_dir,
            save_screenshot,
            load_session_screenshots,
            delete_screenshot,
            sync_local_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

