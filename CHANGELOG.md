# Change Log

## 0.1.6
- Added `Okteto: Create manifest`command to initialize the Okteto manifest.

## 0.1.5
- Clean the SSH config when the terminal is disposed.
- Keep the selected manifest in memory instead of in the workspace state.
- Wait until the SSH server can handle connections.
- Automatically upgrade the okteto binary if not compatible with the plugin.

## 0.1.4
- Use `default` if there's no namespace defined in the context.

## 0.1.3
- On `Okteto: Up` failure, automatically open the terminal to show the user what went wrong.
- Set the `cwd` of the terminal to that of the okteto manifest.

## 0.1.2

- Initial release 🎉🎊.
- Okteto: Install command to install the Okteto binaries.
- Okteto: Up command to start an Okteto environment in your Kubernetes cluster, create an entry in ssh-config and connect with the `Remote - SSH` extension.
- Okteto: Down command to clean everything up.