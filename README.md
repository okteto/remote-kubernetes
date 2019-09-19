# Remote - Kubernetes


The **Remote - Kubernetes** extension uses Okteto to move your development environment to Kubernetes. 

Kubernetes, Okteto and VS Code make a great development environment because you can:

- Forget about building, pushing or deploying containers.
- Launch reproducible development environment with all your tools in seconds.
- Automatically synchronize your code between local and remote environments.
- Eliminate integration issues by developing the same way code runs in production.
- Keep using your favorite tools locally.

The extension starts a development environment in your Kubernetes cluster by using https://github.com/okteto/okteto. Once the environment is ready, the extension prompts you to open it directly in VS Code using the [Visual Studio Code Remote - SSH](https://code.visualstudio.com/docs/remote/ssh) extension.

## Installation

Follow these steps to get started:

1. [Install VS Code](https://code.visualstudio.com/) and [this extension](https://marketplace.visualstudio.com/items?itemName=okteto.remote-kubernetes).
1. [Install and configure](https://github.com/okteto/okteto/blob/master/docs/installation.md) `kubectl`
1. [Download and configure](https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/) your `kubeconfig` file.
1. Run the `Okteto: Up` command!

If you already have `okteto` installed, make sure you're at least on version `1.4.6`.

## Getting started

1. Clone https://github.com/okteto/go-getting-started locally
1. Start VSCode
1. Run the `Okteto: Up` command to launch your development environment in Kubernetes
1. When prompted, select the `go-getting-started` SSH host in the dialog.
1. Once you're connected, use `File > Open Folder` to open the `/okteto` folder on your development environment.
1. Develop directly in Kubernetes!

## Questions and Feedback

Got questions? Have feedback? 

1. See [the documentation](https://github.com/okteto/remote-kubernetes/tree/master/docs/index.md)
1. [Request features](https://github.com/okteto/remote-kubernetes/labels/enhancement), [upvote existing issues](https://github.com/okteto/remote-kubernetes/issues) or [report a problem](https://github.com/okteto/remote-kubernetes/issues/new?template=bug_report.md&title=).
1. Contribute to [our documentation](https://github.com/okteto/remote-kubernetes/tree/master/docs/index.md).
1. Submit a [pull request](https://github.com/okteto/remote-kubernetes/pulls) 😎


## Stay in Touch

Join [the conversation in Slack](https://kubernetes.slack.com/messages/CM1QMQGS0/)! If you don't already have a Kubernetes slack account, [sign up here](http://slack.k8s.io/). 

You can also reach out to [@OktetoHQ](https://twitter.com/oktetohq) on Twitter.

## License

**Remote - Kubernetes** is licensed under the Apache 2.0 License.

This project adheres to the Contributor Covenant [code of conduct](code-of-conduct.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to hello@okteto.com.
