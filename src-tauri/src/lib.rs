use std::collections::HashMap;
use std::fs;
use tauri::Manager;

#[tauri::command]
fn save_log(app_handle: tauri::AppHandle, date: String, content: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    let file_path = logs_dir.join(format!("{}.txt", date));
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
                    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                    logs.insert(file_name, content);
                }
            }
        }
    }
    Ok(logs)
}

#[tauri::command]
fn delete_log(app_handle: tauri::AppHandle, date: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    let file_path = logs_dir.join(format!("{}.txt", date));
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }

    // Also remove any screenshot files associated with this date
    let prefix = format!("{}_img_", date);
    if logs_dir.exists() {
        if let Ok(entries) = fs::read_dir(&logs_dir) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.starts_with(&prefix) {
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
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    let file_path = logs_dir.join(format!("{}_{}", date, filename));
    fs::write(file_path, data_url).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_session_screenshots(app_handle: tauri::AppHandle, date: String) -> Result<Vec<HashMap<String, String>>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_dir.join("logs");
    let mut screenshots = Vec::new();
    let prefix = format!("{}_img_", date);
    
    if logs_dir.exists() {
        for entry in fs::read_dir(logs_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with(&prefix) {
                        let data_url = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                        let mut item = HashMap::new();
                        item.insert("filename".to_string(), file_name.to_string());
                        item.insert("dataUrl".to_string(), data_url);
                        screenshots.push(item);
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
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = app_dir.join("logs").join(filename);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_log,
            load_all_logs,
            delete_log,
            get_log_dir,
            save_screenshot,
            load_session_screenshots,
            delete_screenshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
