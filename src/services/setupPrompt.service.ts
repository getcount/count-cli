import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface PromptLineParams {
  readlineInterface: readline.Interface;
  question: string;
  defaultValue?: string;
}

export async function promptLine(params: PromptLineParams): Promise<string> {
  const { readlineInterface, question, defaultValue } = params;
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const rawAnswer = await readlineInterface.question(`${question}${suffix}: `);
  const trimmedAnswer = rawAnswer.trim();

  if (!trimmedAnswer && defaultValue) {
    return defaultValue;
  }

  return trimmedAnswer;
}

export interface PromptYesNoParams {
  readlineInterface: readline.Interface;
  question: string;
  defaultYes?: boolean;
}

export async function promptYesNo(params: PromptYesNoParams): Promise<boolean> {
  const defaultLabel = params.defaultYes === false ? 'y/N' : 'Y/n';
  const rawAnswer = await params.readlineInterface.question(`${params.question} [${defaultLabel}]: `);
  const normalizedAnswer = rawAnswer.trim().toLowerCase();

  if (!normalizedAnswer) {
    return params.defaultYes !== false;
  }

  return normalizedAnswer === 'y' || normalizedAnswer === 'yes';
}

export interface CreatePromptInterfaceParams {
  inputStream?: NodeJS.ReadableStream;
  outputStream?: NodeJS.WritableStream;
}

export function createPromptInterface(params: CreatePromptInterfaceParams = {}): readline.Interface {
  return readline.createInterface({
    input: params.inputStream ?? input,
    output: params.outputStream ?? output,
  });
}

export interface PromptChoiceParams {
  readlineInterface: readline.Interface;
  question: string;
  choices: string[];
  defaultChoice?: string;
}

export async function promptChoice(params: PromptChoiceParams): Promise<string> {
  const choiceList = params.choices.join(', ');
  const answer = await promptLine({
    readlineInterface: params.readlineInterface,
    question: `${params.question} (${choiceList})`,
    defaultValue: params.defaultChoice,
  });

  if (!params.choices.includes(answer)) {
    throw new Error(`Invalid choice "${answer}". Expected one of: ${choiceList}`);
  }

  return answer;
}
