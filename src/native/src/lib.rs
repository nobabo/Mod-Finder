use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};
use tauri::{Manager, State};

async fn read_state(pool: &SqlitePool) -> Result<Option<String>, String> {
    sqlx::query_scalar("SELECT data FROM local_state WHERE id=1")
        .fetch_optional(pool).await.map_err(|_| "Unable to load local state".into())
}

async fn write_state(pool: &SqlitePool, data: &str) -> Result<(), String> {
    if data.len() > 16 * 1024 * 1024 { return Err("Local state is too large".into()); }
    let value: serde_json::Value = serde_json::from_str(data).map_err(|_| "Invalid local state")?;
    if !value.is_object() { return Err("Invalid local state".into()); }
    sqlx::query("INSERT INTO local_state(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
        .bind(data).execute(pool).await.map_err(|_| "Unable to save local state")?;
    Ok(())
}

#[tauri::command]
async fn load_local_state(pool: State<'_, SqlitePool>) -> Result<Option<String>, String> {
    read_state(&pool).await
}

#[tauri::command]
async fn save_local_state(pool: State<'_, SqlitePool>, data: String) -> Result<(), String> {
    write_state(&pool, &data).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Keep the SQL plugin's original location and schema for existing favorites.
            let directory = app.path().app_config_dir()?;
            std::fs::create_dir_all(&directory)?;
            let pool = tauri::async_runtime::block_on(async {
                let pool = SqlitePoolOptions::new().max_connections(1).connect_with(
                    SqliteConnectOptions::new().filename(directory.join("modfinder.db")).create_if_missing(true),
                ).await?;
                sqlx::query("CREATE TABLE IF NOT EXISTS local_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)").execute(&pool).await?;
                Ok::<_, sqlx::Error>(pool)
            })?;
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_local_state, save_local_state])
        .run(tauri::generate_context!())
        .expect("Unable to start Mod Finder");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_existing_state_and_treats_sql_like_text_as_data() {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
            sqlx::query("CREATE TABLE local_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)").execute(&pool).await.unwrap();
            sqlx::query("INSERT INTO local_state VALUES (1, '{\"favorites\":[]}' )").execute(&pool).await.unwrap();
            assert_eq!(read_state(&pool).await.unwrap().as_deref(), Some("{\"favorites\":[]}"));
            let data = r#"{"name":"'); DROP TABLE local_state; --","favorites":[]}"#;
            write_state(&pool, data).await.unwrap();
            assert_eq!(read_state(&pool).await.unwrap().as_deref(), Some(data));
            assert!(write_state(&pool, "not JSON").await.is_err());
            assert_eq!(read_state(&pool).await.unwrap().as_deref(), Some(data));
        });
    }
}
