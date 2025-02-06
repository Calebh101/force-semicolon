import * as vscode from 'vscode';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

var debug: boolean = false;
var html: boolean = false;
var allowFileAction: boolean = false;

var defaultSeverity = 'error';
var diagnosticSource = 'force-semicolon';
var noSemicolonMessage: string = "Missing or invalid semicolon.";
var unnecessarySemicolonMessage: string = 'Unnecessary semicolon.';
var extraSemicolonMessage: string = 'Extra semicolon.';

var defaultReport = {"0": [], "-1": []};
var report: { [key: string]: any } = defaultReport;

function print(input: any, attachment?: any) {
    if (debug) {
        console.log("force-semicolon: log: " + input, attachment ?? 0);
    }
}

function output(input: any, attachment?: any) {
    console.log("force-semicolon: output: " + input, attachment ?? 0);
}

function warn(input: any, attachment?: any) {
    if (debug) {
        console.warn("force-semicolon: warn: " + input, attachment ?? -1);
    }
}

function printReport(file: string, report: any) {
    if (debug) {
        console.log("force-semicolon: report: report is ready (file: " + file + ")");
        Object.keys(report).slice(0, 100).forEach(key => console.log(key, report[key]));
    }
}

function error(input: any, attachment?: any) {
    console.error("force-semicolon: error: " + input, attachment ?? -1);
}

function action(input: any, attachment?: any) {
    if (debug) {
        console.log("force-semicolon: action: " + input, attachment);
    }
}

function extractText(document: vscode.TextDocument): string | null {
    var text = document.getText();
    if (document.languageId === 'html') {
        if (!html) {
            return null;
        }
        var htmlS = text;
        var jsRegex = /<script.*?>([\s\S]*?)<\/script>/g;
        var matches;
        text = '// force-semicolon auto generated file\n';

        while ((matches = jsRegex.exec(htmlS)) !== null) {
            text += matches[1];
        }
    }
    return text;
}

function parseAst(document: vscode.TextDocument): any {
    try {
        const text = extractText(document);
        if (!text) {
            print("text was null: " + text);
            return null;
        }
        const ast = parse(text, {
            sourceType: "module",
            ranges: true,
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
            allowReturnOutsideFunction: true,
        });

        return ast;
    } catch (e) {
        warn("error with parsing: " + e);
        return null;
    }
}

function handle(index: number, text: string, document: vscode.TextDocument): object {
    var diagnosticsList: Array<any> = [];
    var statements: Array<any> = [];
    var ast = parseAst(document);

    if (!ast) {
        return {diagnostics: []};
    }

    const comments = (ast.comments.map((comment: any) => comment.value)).join(' ');

    if (comments.includes('force-semicolon: ignore-all')) {
        addReport(-1, 'comment.action.ignore-all');
        return {
            diagnostics: [],
            comments: comments,
        };
    }
    
    traverse(ast, {
        enter(path: any) {
            var modeS = 0;
            var node = path.node;
            var isSingleStatement = false;

            if (!node.loc || !node.loc.end) {
                error("invalid node location: " + node.loc);
                return;
            }

            if (isFunctionStatement && node.consequent && node.consequent.type !== "BlockStatement") {
                isSingleStatement = true;
            }

            if (isElseStatement && node.alternate && node.alternate.type !== "BlockStatement") {
                isSingleStatement = true;
            }

            var comments = node.leadingComments ?? [];
            if (comments.length > 0) {
                const comment = comments[comments.length - 1];
                if (comment.value.includes('force-semicolon: ignore')) {
                    modeS = -1;
                }
            }

            if (modeS >= 0) {
                // I don't even know what's going on here
                var isExpressionStatement = path.isExpressionStatement();
                var isVariableDeclaration = path.isVariableDeclaration();
                var isReturnStatement = path.isReturnStatement();
                var isIfStatement = path.isIfStatement();
                var isElseStatement = path.parentPath?.isIfStatement() && path.key === "alternate";
                var isForStatement = path.isForStatement();
                var isWhileStatement = path.isWhileStatement();
                var isDoWhileStatement = path.isDoWhileStatement();
                var isSwitchStatement = path.isSwitchStatement();
                var isFunctionDeclaration = path.isFunctionDeclaration();
                var isFunctionExpression = path.isFunctionExpression();
                var isArrowFunctionExpression = path.isArrowFunctionExpression();
                var isTryStatement = path.isTryStatement();
                var isThrowStatement = path.isThrowStatement();
                var isImportDeclaration = path.isImportDeclaration();
                var isExportDeclaration = path.isExportDeclaration();
                var isClassDeclaration = path.isClassDeclaration();
                var isClassMethod = path.isClassMethod();
                var isExportNamedDeclaration = path.isExportNamedDeclaration();
                var isExportDefaultDeclaration = path.isExportDefaultDeclaration();
                var isCallExpression = path.isCallExpression();
                var isForInStatement = path.isForInStatement();
                var isForOfStatement = path.isForOfStatement();

                var isInLoopHead = Boolean(path.findParent((parent: any) => isVariableDeclaration && (parent.isForStatement() || parent.isForOfStatement() || parent.isForInStatement()) && path.key === "left"));
                var isInObjectProperty = Boolean(path.findParent((parent: any) => parent.isObjectProperty()));
                var isAsyncFunctionExpression = isFunctionExpression && path.node.async;
                var isFunctionArgument = (path.isFunctionExpression() || path.isArrowFunctionExpression()) && path.parentPath?.isCallExpression() && path.key !== "callee";
                var isFunctionStatement = isIfStatement || isForStatement || isWhileStatement || isDoWhileStatement || isForInStatement || isForOfStatement;
                
                var { line, column } = node.loc.end;
                var lineM = line - 1;
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

                if ((isExpressionStatement || isVariableDeclaration || isReturnStatement || isFunctionExpression || isDoWhileStatement || isThrowStatement || isImportDeclaration || isExportDeclaration) && !(isVariableDeclaration && isInLoopHead) && !isArrowFunctionExpression && !isExportNamedDeclaration && !isExportDefaultDeclaration && !isFunctionArgument) {
                    modeS = 1;
                } else if ((isFunctionStatement || isFunctionDeclaration || isElseStatement || isTryStatement || isClassDeclaration || isClassMethod) && !(isVariableDeclaration && isInLoopHead) && !isArrowFunctionExpression && !isSingleStatement) {
                    modeS = 2;
                } else {
                    modeS = 0;
                }

                statements.push({
                    mode: modeS,
                    type: node.type,
                    start: start,
                    end: end,
                    comments: comments,
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
                    isTryStatement,
                    isInLoopHead,
                    isInObjectProperty,
                    isThrowStatement,
                    isImportDeclaration,
                    isExportDeclaration,
                    isExportDefaultDeclaration,
                    isExportNamedDeclaration,
                    isClassDeclaration,
                    isClassMethod,
                    isAsyncFunctionExpression,
                    isCallExpression,
                    isFunctionArgument,
                    isForOfStatement,
                    isForInStatement,
                    isSingleStatement,
                    isFunctionStatement,
                    isElseStatement,
                });
            }
        },
    });

    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const start = statement.start;
        const end = statement.end;
        const range = new vscode.Range(start, end);
        const text = document.getText(range);

        if (statement.mode === 1) {
            if (text.includes(';;')) {
                const diagnostic = new vscode.Diagnostic(
                    range,
                    extraSemicolonMessage,
                );

                diagnosticsList.push({diagnostic: diagnostic, mode: 3});
                addReport(i, 'statements.statement.diagnostic.add.1.1', {'text': text, 'range': range, 'mode': 1, "statement": statement});
            } else {
                if (text.includes(';')) {
                    continue;
                }

                const diagnostic = new vscode.Diagnostic(
                    range,
                    noSemicolonMessage,
                );

                diagnosticsList.push({diagnostic: diagnostic, mode: 1});
                addReport(i, 'statements.statement.diagnostic.add.1.0', {'text': text, 'range': range, 'mode': 1, "statement": statement});
            }
        } else if (statement.mode === 2) {
            if (!text.includes(';')) {
                continue;
            }

            const diagnostic = new vscode.Diagnostic(
                range,
                unnecessarySemicolonMessage,
            );

            diagnosticsList.push({diagnostic: diagnostic, mode: 2});
            addReport(i, 'statements.statement.diagnostic.add.2.0', {'text': text, 'range': range, 'mode': 2, "statement": statement});
        }
    }

    return {
        diagnostics: diagnosticsList,
        comments: comments,
    };
}

function getSeverity(input: string): vscode.DiagnosticSeverity | null {
    switch (input) {
        case 'Info':
        case 'info': return vscode.DiagnosticSeverity.Information;

        case 'Hint':
        case 'hint': return vscode.DiagnosticSeverity.Hint;

        case 'Warning':
        case 'warn': return vscode.DiagnosticSeverity.Warning;

        case 'Error':
        case 'error': return vscode.DiagnosticSeverity.Error;

        case 'Off':
        case 'off': return null;

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
        action('extension.active');
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
        action('workspace.onDidOpenTextDocument');
        updateDiagnostics(document, diagnostics);
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        action('window.onDidChangeActivateTextEditor');
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
        action('command.activate.analyzeAll');
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
    action(name + " (fileAction: " + allowFileAction + ")");
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

function addReport(index: number, type: string, input?: string | object) {
    if (!debug) {
        return;
    }

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
    if (document.languageId !== 'javascript' && document.languageId !== 'typescript' && document.languageId !== 'html') {
        return;
    }

    report = defaultReport;
    report["i"] = {
        "document": document.uri.fsPath,
        "language": document.languageId,
        "mode": 2,
    };

    var config = vscode.workspace.getConfiguration('force-semicolon');
    var diagnosticsList: vscode.Diagnostic[] = [];
    var ignoreAll: boolean = false;
    var missingSeverity: string = config.get<string>('missingSemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var unnecessarySeverity: string = config.get<string>('unnecessarySemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var extraSeverity: string = config.get<string>('extraSemicolonLintType', defaultSeverity) ?? defaultSeverity;

    if ((config.get<boolean>('debug', debug) ?? debug) === true) {
        debug = true;
    }

    const result: Record<string, any> = handle(-1, "", document);
    diagnosticsList = result.diagnostics;
    var diagnosticsS: Array<vscode.Diagnostic> = [];
    diagnosticsList.forEach((item: any, index: number) => {
        var modeS = 0;
        var diagnostic: vscode.Diagnostic = item.diagnostic;
        var off = 'Off';
        var code = 'unknown';

        if (item.mode === 1) {
            modeS = 1;
        } else if (item.mode === 2) {
            modeS = 2;
        } else if (item.mode === 3) {
            modeS = 3;
        } else {
            error("unknown diagnostic.mode: " + item.mode);
            modeS = 0;
        }

        switch (modeS) {
            case 0:
                diagnostic.severity = getSeverity(defaultSeverity)!;
                break;
            case 1:
                if (missingSeverity === off) {
                    modeS = -1;
                }
                diagnostic.severity = getSeverity(missingSeverity)!;
                code = 'missing-semicolon';
                break;
            case 2:
                if (unnecessarySeverity === off) {
                    modeS = -1;
                }
                diagnostic.severity = getSeverity(unnecessarySeverity)!;
                code = 'unnecessary-semicolon';
                break;
            case 3:
                if (extraSeverity === off) {
                    modeS = -1;
                }
                diagnostic.severity = getSeverity(extraSeverity)!;
                code = 'extra-semicolon';
                break;
            default:
                error("unknown modeS: " + modeS);
                modeS = -1;
        }

        if (modeS >= 0) {
            diagnostic.code = code;
            diagnostic.source = diagnosticSource; 
            diagnosticsS.push(diagnostic);
        }
    });

    if (ignoreAll) {
        addReport(-1, 'diagnostics.set', 'ignore');
        diagnostics.set(document.uri, []);
    } else {
        addReport(-1, 'diagnostics.set', 'set');
        diagnostics.set(document.uri, diagnosticsS);
    }

    printReport(document.uri.fsPath, report);
}

async function applyFixForEntireDocument(
    document: vscode.TextDocument,
    diagnosticCode: string
) {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const relevantDiagnostics = diagnostics.filter(d => d.code === diagnosticCode);
    if (relevantDiagnostics.length === 0) {
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    relevantDiagnostics.forEach(diagnostic => {
        switch (diagnostic.code) {
            case "missing-semicolon":
                const position = new vscode.Position(diagnostic.range.end.line, diagnostic.range.end.character);
                edit.insert(document.uri, position, ';');
                break;

            case "unnecessary-semicolon":
            case "extra-semicolon":
                const range = new vscode.Range(diagnostic.range.start, diagnostic.range.end);
                edit.delete(document.uri, range);
                break;
        }
    });

    await vscode.workspace.applyEdit(edit);
}

class SemicolonCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken,
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const diagnostics = context.diagnostics.filter(d => d.source === diagnosticSource);
        var fixes: Array<any> = [];
        if (diagnostics.length === 0) {
            return [];
        }

        diagnostics.forEach(diagnostic => {
            switch (diagnostic.code) {
                case "missing-semicolon":
                    // addFix
                    const addFix = new vscode.CodeAction(
                        'Add semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );
        
                    const position = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    addFix.edit = new vscode.WorkspaceEdit();
                    addFix.edit.insert(document.uri, position, ';');
                    addFix.diagnostics = [diagnostic];
                    fixes.push(addFix);
                    break;

                case "unnecessary-semicolon":
                    // removeFix
                    const removeFixU = new vscode.CodeAction(
                        'Remove unnecessary semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );
        
                    const positionA = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    const range = new vscode.Range(
                        positionA,
                        new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2),
                    );

                    removeFixU.edit = new vscode.WorkspaceEdit();
                    removeFixU.edit.delete(document.uri, range);
                    removeFixU.diagnostics = [diagnostic];
                    fixes.push(removeFixU);
                    break;

                case "extra-semicolon":
                    // removeFix
                    const removeFixE = new vscode.CodeAction(
                        'Remove extra semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );
        
                    const positionB = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    const rangeE = new vscode.Range(
                        positionB,
                        new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2),
                    );

                    removeFixE.edit = new vscode.WorkspaceEdit();
                    removeFixE.edit.delete(document.uri, rangeE);
                    removeFixE.diagnostics = [diagnostic];
                    fixes.push(removeFixE);
                    break;
                
                default:
                    break;
            }
        });

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
    action('extension.deactive');
}
