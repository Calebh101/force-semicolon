import * as vscode from 'vscode';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

var mode: number = 2;
var debug: boolean = true;
var allowFileAction: boolean = false;
var useRegex: boolean = false;

var defaultSeverity = 'error';
var noSemicolonMessage: string = "Missing or invalid semicolon.";
var unnecessarySemicolonMessage: string = 'Unnecessary semicolon.';

var regex: RegExp = /^(?!\..*)(?!.*[\{\}\(\):,/*]).*[^;]$/;
var defaultReport = {"0": [], "-1": []};
var report: { [key: string]: any } = defaultReport;

function print(input: any, attachment?: any) {
    if (debug) {
        console.log("force-semicolon: " + input, attachment);
    }
}

function error(input: any, attachment?: any) {
    console.error("force-semicolon: " + input, attachment);
}

function handle(index: number, text: string, document: vscode.TextDocument): object {
    if (mode == 1) {
        text = removeCommentsOutsideStrings(text).trim();
        var valid = validText(text, document, index);
        var parentheses = handleParentheses(document, index);
        var comments = handleUnclosedComments(document, index);
        var output: boolean = valid && parentheses && !comments;
        return { 
            result: output, 
            validText: valid, 
            parenthesis: parentheses,
            comments: comments 
        };
    } else if (mode == 2) {
        var diagnosticsList: Array<any> = [];
        var statements: Array<any> = [];
        var plugins: Array<any> = ['jsx'];

        if (document.languageId === 'typescript') {
            plugins.push('typescript');
        }

        const ast = parse(document.getText(), {
            sourceType: "module",
            ranges: true,
            plugins: plugins,
        });
        
        traverse(ast, {
            enter(path: any) {
                var isExpressionStatement = path.isExpressionStatement();
                var isVariableDeclaration = path.isVariableDeclaration();
                var isReturnStatement = path.isReturnStatement();
                var isIfStatement = path.isIfStatement();
                var isForStatement = path.isForStatement();
                var isWhileStatement = path.isWhileStatement();
                var isDoWhileStatement = path.isDoWhileStatement();
                var isSwitchStatement = path.isSwitchStatement();
                var isFunctionDeclaration = path.isFunctionDeclaration();
                var isFunctionExpression = path.isFunctionExpression();
                var isArrowFunctionExpression = path.isArrowFunctionExpression();
                var isTryStatement = path.isTryStatement();

                var isInLoopHead = Boolean(
                    path.findParent((parent: any) =>
                        isVariableDeclaration && (parent.isForStatement() || parent.isForOfStatement() || parent.isForInStatement()) && path.key === "left"
                    )
                );

                const { line, column } = path.node.loc.end;
                var lineM = line - 1;
                var lineP = line - 1;
                var columnM = column - 1;
                var columnP = column + 1;

                if (lineM <= 0) {
                    lineM = 0;
                }

                if (columnM <= 0) {
                    columnM = 0;
                }

                const start = new vscode.Position(lineM, columnP);
                const end = new vscode.Position(lineM, columnM);

                const valid = path.node.loc && (isExpressionStatement || isVariableDeclaration || isReturnStatement || isFunctionExpression || isArrowFunctionExpression || isDoWhileStatement) && !(isVariableDeclaration && isInLoopHead);

                statements.push({
                    mode: valid ? 1 : (path.node.loc && (isIfStatement || isWhileStatement || isForStatement || isSwitchStatement || isDoWhileStatement || isFunctionDeclaration || isTryStatement) && !(isVariableDeclaration && isInLoopHead)),
                    type: path.node.type,
                    start: start,
                    end: end,
                    isExpressionStatement,
                    isVariableDeclaration,
                    isReturnStatement,
                    isIfStatement,
                    isForStatement,
                    isWhileStatement,
                    isDoWhileStatement,
                    isSwitchStatement,
                    isFunctionDeclaration,
                    isFunctionExpression,
                    isArrowFunctionExpression,
                    isTryStatement,
                    isInLoopHead,
                });
            },
        });

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const start = statement.start;
            const end = statement.end;
            const range = new vscode.Range(start, end);
            const text = document.getText(range);

            if (statement.mode === 1) {
                if (text.includes(';')) {
                    continue;
                }

                const diagnostic = new vscode.Diagnostic(
                    range,
                    noSemicolonMessage,
                );

                diagnosticsList.push(diagnostic);
                addReport(i, 'statements.statement.diagnostic.add', {'text': text, 'range': range});

                if (i >= 100) {
                    break;
                }
            } else {
                if (!text.includes(';')) {
                    continue;
                }

                const diagnostic = new vscode.Diagnostic(
                    range,
                    unnecessarySemicolonMessage,
                );

                diagnosticsList.push(diagnostic);
                addReport(i, 'statements.statement.diagnostic.add', {'text': text, 'range': range});

                if (i >= 100) {
                    break;
                }
            }
        }

        return {
            diagnostics: diagnosticsList,
        };
    } else {
        throw new Error("handle: invalid mode: " + mode);
    }
}

function validText(input: string, document: vscode.TextDocument, index: number): boolean {
    const nextLine = getNextRelevantLine(document, index);
    if (input.endsWith(')') && nextLine && nextLine.trim().startsWith('.')) {
        return false;
    }

    if (useRegex) {
        return regex.test(input);
    } else {
        return !(input.endsWith('{') || input.endsWith('}') || input.endsWith('[') || input.endsWith('(') || input.endsWith(':') || input.endsWith(',') || input.endsWith('/*') || input.endsWith('*/')) && !(input.endsWith(';')) && !(input.startsWith('.'));
    }
}

function getNextRelevantLine(document: vscode.TextDocument, currentLine: number): string {
    for (let i = currentLine + 1; i < document.lineCount; i++) {
        let lineText = document.lineAt(i).text.trim();

        if (lineText.length > 0 && !lineText.startsWith('//')) {
            return lineText;
        }
    }
    return '';
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
            error("unknown severity: " + input);
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

    let inString = false;
    let stringDelimiter = '';
    
    for (let i = 0; i <= lineIndex; i++) {
        const lineText = document.lineAt(i).text;
        encounter = 0;

        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
            const char = lineText[charIndex];

            if ((char === '"' || char === "'") && (charIndex === 0 || lineText[charIndex - 1] !== '\\')) {
                if (!inString) {
                    inString = true;
                    stringDelimiter = char;
                } else if (char === stringDelimiter) {
                    inString = false;
                }
                continue;
            }

            if (!inString) {
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
            }

            if (openParenthesesCount < 0) {
                return false;
            }
        }
    }

    let condition: boolean = openParenthesesCount === 0;
    let encountered: boolean = encounter > 0;

    if (encounter) {
        return true;
    } else {
        return condition;
    }
}

function handleUnclosedComments(document: vscode.TextDocument, lineIndex: number): boolean {
    let commentOpenCount = 0;

    for (let i = 0; i <= lineIndex; i++) {
        const lineText = document.lineAt(i).text;

        let startIndex = 0;
        while ((startIndex = lineText.indexOf('/*', startIndex)) !== -1) {
            commentOpenCount++;
            startIndex += 2;
        }

        let endIndex = 0;
        while ((endIndex = lineText.indexOf('*/', endIndex)) !== -1) {
            commentOpenCount--;
            endIndex += 2;
        }

        if (commentOpenCount < 0) {
            return false;
        }
    }

    return commentOpenCount > 0; // true if unclosed
}

function addReport(index: number, type: string, input?: string | object) {
    var generated = {
        "index": index,
        "type": type,
        "value": input,
    };

    if (index <= -1) {
        report[`${index}`].push(generated);
    } else {
        report[`${index}`] = generated;
    }
}

function updateDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection) {
    if (document.languageId !== 'javascript' && document.languageId !== 'typescript') {
        return;
    }

    report = defaultReport;
    report["i"] = {
        "document": document.uri.fsPath,
        "language": document.languageId,
        "mode": mode,
    };

    var config = vscode.workspace.getConfiguration('force-semicolon');
    var diagnosticsList: vscode.Diagnostic[] = [];
    var ignoreAll: boolean = false;
    var severity: vscode.DiagnosticSeverity = getSeverity(config.get<string>('lintType', defaultSeverity) ?? defaultSeverity);

    if (mode === 1) {
        for (let i = 0; i < document.lineCount; i++) {
            var origLineText: string = document.lineAt(i).text;
            var lineText: string = origLineText.trim();

            if (lineText.length > 0) {
                if (lineText.startsWith('//')) {
                    if (lineText.includes("force-semicolon: ignore-all")) {
                        ignoreAll = true;
                        addReport(i, "comment.action", "general.all.ignore");
                    } else if (lineText.includes("force-semicolon: ignore")) {
                        i++;
                        addReport(i, "comment.action", "general.one.ignore");
                    } else {
                        addReport(i, "comment.generic");
                    }
                } else {
                    const result: Record<string, any> = handle(i, lineText, document);
                    addReport(i, (result.result ? "line.scan.success" : (("error" in result) ? "line.scan.error" : "line.scan.fail")), result);
                    if (result.result) {
                        const lineLength = origLineText.length;
                        const lastCharPosition = new vscode.Position(i, lineLength - 1);
                        const range = new vscode.Range(lastCharPosition, lastCharPosition);

                        const diagnostic = new vscode.Diagnostic(
                            range,
                            noSemicolonMessage,
                        );
                        diagnosticsList.push(diagnostic);
                    } else {
                        if ("error" in result) {
                            error(result.error);
                            return;
                        }
                    }
                }
            }
        }
    } else if (mode === 2) {
        const result: Record<string, any> = handle(-1, "", document);
        diagnosticsList = result.diagnostics;
    }

    diagnosticsList.forEach((item: vscode.Diagnostic, index: number) => {
        item.severity = severity;
    });

    if (ignoreAll) {
        addReport(-1, 'diagnostics.set', 'ignore');
        diagnostics.set(document.uri, []);
    } else {
        addReport(-1, 'diagnostics.set', 'set');
        diagnostics.set(document.uri, diagnosticsList);
    }

    print("report generated:", report);
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

        if (char === '/' && (nextChar === '/' || nextChar === '*') && !inString && !inTemplate) {
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
        token: vscode.CancellationToken,
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const diagnostics = context.diagnostics.filter(d => d.message === noSemicolonMessage);
        var fixes: Array<any> = [];
        if (diagnostics.length === 0) {
            return [];
        }

        // initialize fixes
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
        diagnostics.forEach(diagnostic => {
            const addFix = new vscode.CodeAction(
                'Add semicolon',
                vscode.CodeActionKind.QuickFix,
            );

            const position = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
            addFix.edit = new vscode.WorkspaceEdit();
            addFix.edit.insert(document.uri, position, ';');
            addFix.diagnostics = [diagnostic];
            fixes.push(addFix);
        });

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
