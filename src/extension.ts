import * as vscode from 'vscode';

var debug: boolean = true;
var message: string = "No semicolon found.";
var severity: vscode.DiagnosticSeverity = getSeverity('default');

function print(input: any) {
    if (debug) {
        console.log("force-semicolon: " + input);
    }
}

function getSeverity(input: string): vscode.DiagnosticSeverity {
    switch (input) {
        case 'default': return getSeverity('error');
        case 'info': return vscode.DiagnosticSeverity.Information;
        case 'hint': return vscode.DiagnosticSeverity.Hint;
        case 'warn': return vscode.DiagnosticSeverity.Warning;
        case 'error': return vscode.DiagnosticSeverity.Error;

        default:
            print("error: unknown severity: " + input);
            return getSeverity('default');
    }
}

export function activate(context: vscode.ExtensionContext) {
	print('force-semicolon is active (debug: ' + debug + ')');
    const diagnostics = vscode.languages.createDiagnosticCollection('a');
    context.subscriptions.push(diagnostics);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        print("action: extension.activate");
        updateDiagnostics(editor.document, diagnostics);
    }

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            updateDiagnostics(editor.document, diagnostics);
        }
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        print("action: workspace.onDidOpenTextDocument");
        updateDiagnostics(document, diagnostics);
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        print("action: window.onDidChangeActiveTextEditor");
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

function areBalanced(document: vscode.TextDocument, lineIndex: number): boolean {
    let openParenthesesCount: number = 0;
    let condition: boolean = true;

    for (let i = 0; i < lineIndex; i++) {
        const lineText = document.lineAt(i).text;
        
        for (let char of lineText) {
            if (char === '(') {
                openParenthesesCount++;
            } else if (char === ')') {
                openParenthesesCount--;
            }

            if (openParenthesesCount < 0) {
                return false;
            }
        }
    }

    condition = openParenthesesCount === 0;
    print("parentheses balanced (line " + lineIndex + "): " + condition);
    return condition;
}

function updateDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection) {
    if (document.languageId !== 'javascript' && document.languageId !== 'typescript') {
        print("invalid language: " + document.languageId);
        return;
    }

    const diagnosticsList: vscode.Diagnostic[] = [];
    var ignoreAll: boolean = false;

    for (let i = 0; i < document.lineCount; i++) {
        var origLineText: string = document.lineAt(i).text;
        var lineText: string = origLineText.trim();

        if (lineText.length <= 0) {
        } else if (lineText.startsWith('//')) {
            if (lineText.includes("force-semicolon: ignore-all")) {
                ignoreAll = true;
            }
            if (lineText.includes("force-semicolon: ignore")) {
                i++;
            }
        } else {
            lineText = removeCommentsOutsideStrings(lineText).trim();
            if (!(lineText.endsWith('{') || lineText.endsWith('}') || lineText.endsWith('(') || lineText.endsWith(':')) && !(lineText.endsWith(';')) && (areBalanced(document, i))) {
                const lineLength = origLineText.length;
                const lastCharPosition = new vscode.Position(i, lineLength - 1);
                const range = new vscode.Range(lastCharPosition, lastCharPosition);

                const diagnostic = new vscode.Diagnostic(
                    range,
                    message,
                    severity,
                );

                print("found: issue at line " + i);
                diagnosticsList.push(diagnostic);
            }
        }
    }

    if (ignoreAll) {
        print("ignoring diagnostics...");
        diagnostics.set(document.uri, []);
    } else {
        print("setting diagnostics...");
        diagnostics.set(document.uri, diagnosticsList);
    }
}

function removeCommentsOutsideStrings(line: string): string {
    let inString = false;
    let inTemplate = false;
    let result = "";
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && !inTemplate) {
            inString = !inString;
        } else if (char === "'" && !inTemplate) {
            inString = !inString;
        } else if (char === '`' && !inString) {
            inTemplate = !inTemplate;
        }

        if (char === '/' && nextChar === '/' && !inString && !inTemplate) {
            return result;
        }

        result += char;
        i++;
    }

    return result;
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
        const trimmedText = lineText.trimEnd();

        if (trimmedText.length <= 0) {
            return [];
        }

        const lastNonWhitespacePos = new vscode.Position(range.start.line, trimmedText.length);
        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.insert(document.uri, lastNonWhitespacePos, ';');

        return [fix];
    }
}

export function deactivate() {}
