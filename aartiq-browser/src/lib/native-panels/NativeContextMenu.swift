import AppKit

@objc public class NativeContextMenu: NSObject {
    
    private var webContents: Any?
    private var activeWindow: Any?
    
    @objc public static let shared = NativeContextMenu()
    
    private override init() {
        super.init()
    }
    
    @objc public func setupContextMenu(for webContents: Any) {
        self.webContents = webContents
    }
    
    @objc public func showMenu(at point: NSPoint, params: [String: Any]) {
        let menu = buildContextMenu(params: params)
        if let window = NSApp.keyWindow, let contentView = window.contentView {
            let loc = window.convertPoint(toScreen: point)
            menu.popUp(positioning: nil, at: loc, in: contentView)
        }
    }
    
    private func buildContextMenu(params: [String: Any]) -> NSMenu {
        let menu = NSMenu(title: "Context")
        
        let hasSelection = (params["selectionText"] as? String)?.isEmpty == false
        let hasImage = (params["isImage"] as? Bool) == true
        let hasLink = (params["linkURL"] as? String)?.isEmpty == false
        let canEdit = (params["isEditable"] as? Bool) == true
        let inputField = (params["inputFieldType"] as? String) != nil
        
        menu.addItem(withTitle: "Cut", action: #selector(cutAction(_:)), keyEquivalent: "x").target = self
        menu.addItem(withTitle: "Copy", action: #selector(copyAction(_:)), keyEquivalent: "c").target = self
        menu.addItem(withTitle: "Paste", action: #selector(pasteAction(_:)), keyEquivalent: "v").target = self
        menu.addItem(withTitle: "Select All", action: #selector(selectAllAction(_:)), keyEquivalent: "a").target = self
        
        menu.addItem(NSMenuItem.separator())
        
        if hasSelection {
            menu.addItem(withTitle: "Search with Google", action: #selector(searchGoogleAction(_:)), keyEquivalent: "").target = self
            menu.addItem(withTitle: "Translate", action: #selector(translateAction(_:)), keyEquivalent: "").target = self
            menu.addItem(withTitle: "Look Up", action: #selector(lookupAction(_:)), keyEquivalent: "").target = self
            menu.addItem(NSMenuItem.separator())
        }
        
        if hasLink {
            let linkItem = menu.addItem(withTitle: "Open Link in New Tab", action: #selector(openLinkNewTabAction(_:)), keyEquivalent: "")
            linkItem.target = self
        }
        
        if hasImage {
            menu.addItem(withTitle: "Save Image As...", action: #selector(saveImageAction(_:)), keyEquivalent: "").target = self
            menu.addItem(withTitle: "Copy Image", action: #selector(copyImageAction(_:)), keyEquivalent: "").target = self
        }
        
        if inputField || canEdit {
            menu.addItem(NSMenuItem.separator())
            menu.addItem(withTitle: "Inspect Element", action: #selector(inspectAction(_:)), keyEquivalent: "i").target = self
        }
        
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Reload", action: #selector(reloadAction(_:)), keyEquivalent: "r").target = self
        
        return menu
    }
    
    @objc private func cutAction(_ sender: Any) {
        notifyElectron(action: "cut")
    }
    
    @objc private func copyAction(_ sender: Any) {
        notifyElectron(action: "copy")
    }
    
    @objc private func pasteAction(_ sender: Any) {
        notifyElectron(action: "paste")
    }
    
    @objc private func selectAllAction(_ sender: Any) {
        notifyElectron(action: "selectAll")
    }
    
    @objc private func searchGoogleAction(_ sender: Any) {
        notifyElectron(action: "search-google")
    }
    
    @objc private func translateAction(_ sender: Any) {
        notifyElectron(action: "translate")
    }
    
    @objc private func lookupAction(_ sender: Any) {
        notifyElectron(action: "lookup")
    }
    
    @objc private func openLinkNewTabAction(_ sender: Any) {
        notifyElectron(action: "open-link-new-tab")
    }
    
    @objc private func saveImageAction(_ sender: Any) {
        notifyElectron(action: "save-image")
    }
    
    @objc private func copyImageAction(_ sender: Any) {
        notifyElectron(action: "copy-image")
    }
    
    @objc private func inspectAction(_ sender: Any) {
        notifyElectron(action: "inspect")
    }
    
    @objc private func reloadAction(_ sender: Any) {
        notifyElectron(action: "reload")
    }
    
    private func notifyElectron(action: String) {
        NotificationCenter.default.post(
            name: NSNotification.Name("NativeContextMenuAction"),
            object: nil,
            userInfo: ["action": action]
        )
    }
}

@objc public class NativeContextMenuManager: NSObject {
    
    private let nativeMenu = NativeContextMenu.shared
    private var isEnabled = true
    
    @objc public static let shared = NativeContextMenuManager()
    
    private override init() {
        super.init()
    }
    
    @objc public func enable(_ enabled: Bool) {
        isEnabled = enabled
    }
    
    @objc public func show(at point: NSPoint, params: [String: Any]) {
        guard isEnabled else { return }
        DispatchQueue.main.async { [weak self] in
            self?.nativeMenu.showMenu(at: point, params: params)
        }
    }
    
    @objc public func register() {
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("NativeContextMenuAction"),
            object: nil,
            queue: .main
        ) { notification in
            if let action = notification.userInfo?["action"] as? String {
                self.handleMenuAction(action)
            }
        }
    }
    
    private func handleMenuAction(_ action: String) {
        print("[NativeContextMenu] Action: \(action)")
    }
}