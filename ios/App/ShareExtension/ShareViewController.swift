import ObjectiveC
import UIKit
import UniformTypeIdentifiers

// A share extension runs in its own process and can't reach the app or its web view, so the
// payload is handed over as a flotilla://share url, which the root layout picks up via
// appUrlOpen. Media is far too big for a url, so it gets copied into the shared app group
// container — the one directory both processes can read — and passed along by path.
class ShareViewController: UIViewController {
  private let appGroup = "group.social.flotilla"

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)

    let attachments = (extensionContext?.inputItems.first as? NSExtensionItem)?.attachments ?? []

    // Browsers attach a page's title alongside its url, so take these in order of specificity.
    // Photos offers a jpeg representation of a heic asset, which saves us re-encoding it later.
    for type in [UTType.movie, UTType.jpeg, UTType.image, UTType.url, UTType.plainText] {
      for provider in attachments where provider.hasItemConformingToTypeIdentifier(type.identifier) {
        provider.loadItem(forTypeIdentifier: type.identifier) { value, _ in
          if type == .url {
            self.shareText((value as? URL)?.absoluteString)
          } else if type == .plainText {
            self.shareText(value as? String)
          } else {
            self.shareFile(value)
          }
        }

        return
      }
    }

    finish()
  }

  private func shareText(_ text: String?) {
    guard let text = text else {
      return finish()
    }

    open([URLQueryItem(name: "text", value: text)])
  }

  private func shareFile(_ value: NSSecureCoding?) {
    let manager = FileManager.default

    guard let container = manager.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      return finish()
    }

    // Nothing prunes the group container for us, and the app is done with the last share by the
    // time a new one arrives. Emptying a directory of our own leaves the rest of the container,
    // Library/ included, alone.
    let directory = container.appendingPathComponent("shares")

    try? manager.removeItem(at: directory)

    do {
      try manager.createDirectory(at: directory, withIntermediateDirectories: true)

      if let source = value as? URL {
        let destination = directory.appendingPathComponent(source.lastPathComponent)

        try manager.copyItem(at: source, to: destination)
        open(file: destination)
      } else if let image = value as? UIImage, let data = image.jpegData(compressionQuality: 0.9) {
        let destination = directory.appendingPathComponent("shared.jpg")

        try data.write(to: destination)
        open(file: destination)
      } else {
        finish()
      }
    } catch {
      finish()
    }
  }

  private func open(file: URL) {
    open([
      URLQueryItem(name: "path", value: file.path),
      URLQueryItem(name: "name", value: file.lastPathComponent),
      URLQueryItem(
        name: "type",
        value: UTType(filenameExtension: file.pathExtension)?.preferredMIMEType
      ),
    ])
  }

  private func open(_ queryItems: [URLQueryItem]) {
    guard var components = URLComponents(string: "flotilla://share") else {
      return finish()
    }

    components.queryItems = queryItems

    guard let url = components.url else {
      return finish()
    }

    DispatchQueue.main.async {
      NSLog("Flotilla: opening %@", url.absoluteString)

      // Which of these works varies by ios version and neither reports whether the app actually
      // came forward, so try both. Opening the same url twice is harmless.
      let foundApplication = self.openViaResponderChain(url)

      self.extensionContext?.open(url) { opened in
        NSLog(
          "Flotilla: responder chain %@, extensionContext.open %@",
          foundApplication ? "found UIApplication" : "found nothing",
          opened ? "succeeded" : "failed"
        )

        // Completing the request tears down the extension, which can cancel an open springboard
        // hasn't picked up yet
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
          self.finish()
        }
      }
    }
  }

  // UIApplication isn't reachable from an extension, so walk the responder chain to find it. Its
  // open(_:options:completionHandler:) isn't visible to us at compile time either, and the
  // openURL: that extensions used for years now force-returns false, so call it via the runtime.
  private func openViaResponderChain(_ url: URL) -> Bool {
    let selector = NSSelectorFromString("openURL:options:completionHandler:")
    var responder: UIResponder? = self

    while let current = responder {
      if let application = current as? UIApplication,
        let method = class_getInstanceMethod(type(of: application), selector)
      {
        typealias OpenURL = @convention(c) (UIApplication, Selector, NSURL, NSDictionary, AnyObject?)
          -> Void

        let open = unsafeBitCast(method_getImplementation(method), to: OpenURL.self)
        let completion: @convention(block) (Bool) -> Void = { opened in
          NSLog("Flotilla: UIApplication.open %@", opened ? "succeeded" : "failed")
        }

        open(application, selector, url as NSURL, NSDictionary(), completion as AnyObject)

        return true
      }

      responder = current.next
    }

    return false
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }
}
