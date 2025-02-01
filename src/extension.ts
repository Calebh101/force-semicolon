import * as vscode from 'vscode';
var message: string = "No semicolon found.";

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "force-semicolon" is now active!');
    const diagnostics = vscode.languages.createDiagnosticCollection('a');
    context.subscriptions.push(diagnostics);

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            updateDiagnostics(editor.document, diagnostics);
        }
    });

    vscode.languages.registerCodeActionsProvider(
        { language: 'javascript', scheme: 'file' },
        new SemicolonCodeActionProvider()
    );
    vscode.languages.registerCodeActionsProvider(
        { language: 'typescript', scheme: 'file' },
        new SemicolonCodeActionProvider()
    );
}

function updateDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection) {
    const diagnosticsList: vscode.Diagnostic[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text.trim();
        
        if (!(lineText.endsWith('{') || lineText.endsWith('}')) && !(lineText.endsWith(';'))) {
			const lineLength = lineText.length;
            const lastCharPosition = new vscode.Position(i, lineLength - 1);
            const range = new vscode.Range(lastCharPosition, lastCharPosition);

            const diagnostic = new vscode.Diagnostic(
                range,
                message,
                vscode.DiagnosticSeverity.Error,
            );
            diagnosticsList.push(diagnostic);
        }
    }

    diagnostics.set(document.uri, diagnosticsList);
}

class SemicolonCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const diagnostics = context.diagnostics.filter(d => d.message === message);
        if (diagnostics.length === 0) {
            return [];
        }

        const fix = new vscode.CodeAction(
            'Add semicolon',
            vscode.CodeActionKind.QuickFix
        );

        const lineText = document.lineAt(range.start.line).text;
        const trimmedText = lineText.trimEnd();  // Remove trailing spaces
        const lastNonWhitespacePos = new vscode.Position(range.start.line, trimmedText.length);

        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.insert(document.uri, lastNonWhitespacePos, ';');

        return [fix];
    }
}

export function deactivate() {}
