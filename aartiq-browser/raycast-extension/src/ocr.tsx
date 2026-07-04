import { runAppleScript, closeMainWindow, showHUD } from "@raycast/utils";
import { showToast, Toast } from "@raycast/api";

export default async function OCRCommand() {
  try {
    await showToast({
      style: Toast.Style.Animated,
      title: "Capturing screen...",
    });

    const result = await runAppleScript(`
      tell application "Aartiq"
        activate
        if exists then
          tell application "System Events"
            tell process "Aartiq"
              set frontmost to true
            end tell
          end tell
          
          -- Trigger OCR via keyboard shortcut
          keystroke "o" using {command down, shift down}
        end if
      end tell
    `);

    await showHUD("Screen capture initiated");
    await closeMainWindow();
  } catch (e) {
    await showToast({
      style: Toast.Style.Failure,
      title: "OCR Failed",
      message: String(e),
    });
  }
}