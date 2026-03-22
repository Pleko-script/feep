use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, Window, WindowEvent,
};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_OPEN_ID: &str = "open";
const TRAY_QUIT_ID: &str = "quit";

struct AppState {
    is_quitting: AtomicBool,
}

fn restore_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window<R: Runtime>(window: &Window<R>) {
    let _ = window.hide();
}

fn should_handle_main_window_close<R: Runtime>(window: &Window<R>) -> bool {
    window.label() == MAIN_WINDOW_LABEL
}

fn is_real_quit<R: Runtime>(window: &Window<R>) -> bool {
    window.state::<AppState>().is_quitting.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            is_quitting: AtomicBool::new(false),
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            restore_main_window(app);
        }))
        .setup(|app| {
            let open_item = MenuItemBuilder::with_id(TRAY_OPEN_ID, "Öffnen").build(app)?;
            let quit_item = MenuItemBuilder::with_id(TRAY_QUIT_ID, "Beenden").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&open_item, &quit_item])
                .build()?;

            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("Pomofocus")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    TRAY_OPEN_ID => restore_main_window(app),
                    TRAY_QUIT_ID => {
                        app.state::<AppState>()
                            .is_quitting
                            .store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_main_window(&tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }

            tray.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if !should_handle_main_window_close(window) || is_real_quit(window) {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                hide_main_window(window);
            }
        })
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
