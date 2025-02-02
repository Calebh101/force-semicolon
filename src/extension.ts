import * as vscode from 'vscode';

var debug: boolean = true;
var allowFileAction: boolean = false;
const useRegex: boolean = false;

var defaultSeverity = 'error';
var message: string = "No semicolon found.";

const regex: RegExp = /^(?!\..*)(?!.*[\{\}\(\):,/*]).*[^;]$/;
var config = vscode.workspace.getConfiguration('force-semicolon');

function print(input: any) {
    if (debug) {
        console.log("force-semicolon: " + input);
    }
}

function validText(input: string, document: vscode.TextDocument, index: number): boolean {
    const nextLine = getNextRelevantLine(document, index);
    if (input.endsWith(')') && nextLine && nextLine.trim().startsWith('.')) {
        return false; // No semicolon needed
    }

    if (useRegex) {
        return regex.test(input);
    } else {
        return !(input.endsWith('{') || input.endsWith('}') || input.endsWith('(') || input.endsWith(':') || input.endsWith(',') || input.endsWith('/*') || input.endsWith('*/')) && !(input.endsWith(';')) && !(input.startsWith('.'));
    }
}

function getNextRelevantLine(document: vscode.TextDocument, currentLine: number): string {
    for (let i = currentLine + 1; i < document.lineCount; i++) {
        let lineText = document.lineAt(i).text.trim();

        // Ignore empty lines and full-line comments
        if (lineText.length > 0 && !lineText.startsWith('//')) {
            return lineText;
        }
    }
    return ''; // No relevant line found
}

function getSeverity(input: string): vscode.DiagnosticSeverity {
    switch (input) {
        case 'Info':
        case 'info': return vscode.DiagnosticSeverity.Information;

        case 'Hint':
        case 'hint': return vscode.DiagnosticSeverity.Hint;

        case 'Warning':
        case 'warn': return vscode.DiagnosticSeverity.Warning;

        case 'Error':
        case 'error': return vscode.DiagnosticSeverity.Error;

        default:
            print("error: unknown severity: " + input);
            return getSeverity(defaultSeverity);
    }
}

export function activate(context: vscode.ExtensionContext) {
	print('force-semicolon is active (debug: ' + debug + ')');
    const diagnostics = vscode.languages.createDiagnosticCollection('a');
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        print("action: extension.activate");
        updateDiagnostics(editor.document, diagnostics);
        analyzeAll(diagnostics);
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

    vscode.workspace.onDidCreateFiles((event) => {
        fileAction('workspace.onDidCreateFiles', diagnostics);
    });

    vscode.workspace.onDidRenameFiles((event) => {
        fileAction('workspace.onDidRenameFiles', diagnostics);
    });

    let analyzeAllCommand = vscode.commands.registerCommand('force-semicolon.analyzeAll', () => {
        print("action: command.force-semicolon.analyzeAll");
        analyzeAll(diagnostics);
    });

    context.subscriptions.push(diagnostics);
    context.subscriptions.push(analyzeAllCommand);

    vscode.languages.registerCodeActionsProvider(
        { language: 'javascript', scheme: 'file' },
        new SemicolonCodeActionProvider()
    );
    vscode.languages.registerCodeActionsProvider(
        { language: 'typescript', scheme: 'file' },
        new SemicolonCodeActionProvider()
    );
}

function fileAction(name: string, diagnostics: vscode.DiagnosticCollection) {
    print("action: " + name + " (fileAction[" + allowFileAction + "])");
    if (allowFileAction) {
        analyzeAll(diagnostics);
    }
}

function analyzeAll(diagnostics: vscode.DiagnosticCollection) {
    vscode.workspace.findFiles('**/*.{js,ts}', '**/node_modules/**').then(files => {
        files.forEach(fileUri => {
            vscode.workspace.openTextDocument(fileUri).then(document => {
                updateDiagnostics(document, diagnostics);
            });
        });
    });
}

function handleParentheses(document: vscode.TextDocument, lineIndex: number): boolean {
    let type = "rounded";
    let openParenthesesCount: number = 0;
    let encounter: number = 0;

    let open = '';
    let close = '';

    switch (type) {
        case 'rounded': 
            open = '(';
            close = ')';
            break;
        case 'curved':
            open = '{';
            close = '}';
            break;
        default:
            return handleParentheses(document, lineIndex);
    }

    for (let i = 0; i <= lineIndex; i++) {
        const lineText = document.lineAt(i).text;
        encounter = 0;
        
        for (let char of lineText) {
            if (char === open) {
                openParenthesesCount++;
            } else if (char === close) {
                openParenthesesCount--;
            }

            if (type === "rounded" && char === '{') {
                encounter++;
            }

            if (type === "rounded" && char === '}') {
                encounter--;
            }

            if (openParenthesesCount < 0) {
                return false;
            }
        }
    }

    let condition: boolean = openParenthesesCount === 0;
    let encountered: boolean = encounter > 0;
    print("parentheses balanced (type: " + type + ") (line: " + lineIndex + "): " + condition + " (encounter: " + encounter + ":" + encountered + ")");

    if (encounter) {
        return true;
    } else {
        return condition;
    }
}

function updateDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection) {
    if (document.languageId !== 'javascript' && document.languageId !== 'typescript') {
        return;
    }

    var diagnosticsList: vscode.Diagnostic[] = [];
    var ignoreAll: boolean = false;
    var severity: vscode.DiagnosticSeverity = getSeverity(config.get<string>('lintType', defaultSeverity) ?? defaultSeverity);

    for (let i = 0; i < document.lineCount; i++) {
        var origLineText: string = document.lineAt(i).text;
        var lineText: string = origLineText.trim();

        if (lineText.length > 0) {
            if (lineText.startsWith('//')) {
                if (lineText.includes("force-semicolon: ignore-all")) {
                    print("action: general.all.ignore (line: " + i + ")");
                    ignoreAll = true;
                }
                if (lineText.includes("force-semicolon: ignore")) {
                    print("action: general.one.ignore (line: " + i + ")");
                    i++;
                }
                if (lineText.includes("force-semicolon lint-type: error")) {
                    print("action: lint-type.set.error (line: " + i + ")");
                    severity = getSeverity("error");
                }
                if (lineText.includes("force-semicolon lint-type: warning")) {
                    print("action: lint-type.set.warn (line: " + i + ")");
                    severity = getSeverity("warn");
                }
                if (lineText.includes("force-semicolon lint-type: info")) {
                    print("action: lint-type.set.info (line: " + i + ")");
                    severity = getSeverity("info");
                }
            } else {
                lineText = removeCommentsOutsideStrings(lineText).trim();
                if (validText(lineText, document, i) && handleParentheses(document, i)) {
                    const lineLength = origLineText.length;
                    const lastCharPosition = new vscode.Position(i, lineLength - 1);
                    const range = new vscode.Range(lastCharPosition, lastCharPosition);

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                    );

                    print("found: issue at line " + i);
                    diagnosticsList.push(diagnostic);
                }
            }
        }
    }

    diagnosticsList.forEach((item: vscode.Diagnostic, index: number) => {
        item.severity = severity;
    });    

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
        var fixes: Array<any> = [];
        if (diagnostics.length === 0) {
            return [];
        }

        // initialize fixes
        const addFix = new vscode.CodeAction(
            'Add semicolon',
            vscode.CodeActionKind.QuickFix,
        );

        const ignoreFix = new vscode.CodeAction(
            'Ignore this line',
            vscode.CodeActionKind.QuickFix,
        );

        const ignoreAllFix = new vscode.CodeAction(
            'Ignore this file',
            vscode.CodeActionKind.QuickFix,
        );

        const lineText = document.lineAt(range.start.line).text;
        const trimmedText = lineText.trimEnd();
        const spaces = getLeadingSpaces(lineText);

        if (trimmedText.length <= 0) {
            return [];
        }

        // addFix
        const lastNonWhitespacePos = new vscode.Position(range.start.line, trimmedText.length);
        addFix.edit = new vscode.WorkspaceEdit();
        addFix.edit.insert(document.uri, lastNonWhitespacePos, ';');
        fixes.push(addFix);

        // ignoreFix
        const pos = new vscode.Position(range.start.line, 0);
        ignoreFix.edit = new vscode.WorkspaceEdit();
        ignoreFix.edit.insert(document.uri, pos, ' '.repeat(spaces) + '// force-semicolon: ignore\n');
        fixes.push(ignoreFix);

        // ignoreAllFix
        const posA = new vscode.Position(0, 0);
        ignoreAllFix.edit = new vscode.WorkspaceEdit();
        ignoreAllFix.edit.insert(document.uri, posA, '// force-semicolon: ignore-all\n');
        fixes.push(ignoreAllFix);

        return fixes;
    }
}

function getLeadingSpaces(lineText: string): number {
    const match = lineText.match(/^(\s*)/);
    return match ? match[0].length : 0;
}

export function deactivate() {
    print("deactivating...");
}
