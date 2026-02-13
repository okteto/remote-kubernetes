# Remote - Kubernetes


The **Remote - Kubernetes** extension uses Okteto to move your development environment to Kubernetes. 

Kubernetes, Okteto and VS Code make a great development environment because you can:

- Launch reproducible development environment with all your tools in seconds.
- Automatically synchronize your code between local and remote environments.
- Eliminate integration issues by developing the same way code runs in production.
- Keep using your favorite tools.
- Forget about building images or redeploying containers to test your changes in Kubernetes.
- Run your tests directly in Kubernetes

The extension starts a development environment in your Kubernetes cluster by using https://github.com/okteto/okteto. Once the environment is ready, the extension prompts you to open it directly in VS Code using the [Visual Studio Code Remote - SSH](https://code.visualstudio.com/docs/remote/ssh) extension.

## Requirements

1. VS Code 1.88 or newer.
1. Deploy access to a Kubernetes cluster.
1. An OpenSSH compatible [SSH client](https://code.visualstudio.com/docs/remote/troubleshooting#_installing-a-supported-ssh-client) available in your workstation.

## Installation

1. [Install VS Code](https://code.visualstudio.com/) and [this extension](https://marketplace.visualstudio.com/items?itemName=okteto.remote-kubernetes).
1. Install the [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension.
1. [Download and configure](https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/) your `kubeconfig` file.

## Getting started

There is a complete tutorial [here](https://okteto.com/blog/remote-kubernetes-development/). The steps can be summarized as follows:

1. Clone https://github.com/okteto/vscode-remote-go
1. Start VS Code
1. Run the `Okteto: Up` command to launch your development environment in Kubernetes. When prompted, pick the `okteto.yml` manifest.
1. After a few seconds, you'll be asked to select a host. Pick the `vscode-remote-go.okteto` entry from the dialog to launch your remote VS Code instance.
1. Develop directly in Kubernetes from VS Code!

### Supported Manifest Files

The extension automatically detects Okteto manifest files in your workspace:

- **Standard manifests**: `okteto.yml`, `okteto.yaml`, `docker-compose.yml`, `docker-compose.yaml`
- **Pipeline manifests**: `okteto-pipeline.yml`, `okteto-pipeline.yaml`
- **Custom patterns**: `okteto-*.yml`, `okteto.*.yml` (e.g., `okteto.dev.yml`, `okteto-stack.yml`)

All commands (`Up`, `Deploy`, `Destroy`, `Test`) support the same manifest patterns, enabling flexible project organization.

See the [Manifest Patterns documentation](docs/manifest-patterns.md) for complete details and use cases.

## Questions and Feedback

Got questions? Have feedback? 

1. See [the documentation](docs/index.md)
1. [Request features](https://github.com/okteto/remote-kubernetes/labels/enhancement), [upvote existing issues](https://github.com/okteto/remote-kubernetes/issues) or [report a problem](https://github.com/okteto/remote-kubernetes/issues/new?template=bug_report.md&title=).
1. Contribute to [our documentation](docs/index.md).
1. Submit a [pull request](https://github.com/okteto/remote-kubernetes/pulls) 😎


## Stay in Touch

Join [the conversation in our online community](https://community.okteto.com).  You can also reach out to [@OktetoHQ](https://twitter.com/oktetohq) on Twitter.

## License

**Remote - Kubernetes** is licensed under the Apache 2.0 License.

This project adheres to the Contributor Covenant [code of conduct](code-of-conduct.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to hello@okteto.com.
