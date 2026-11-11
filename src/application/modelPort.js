// What the help desk needs from any AI model, whoever provides it.
//
// A model has one method:
//   generate({ systemInstruction, input, responseSchema }) -> Promise<string>
// It resolves with the model's raw text reply, or rejects with ModelUnavailableError when the
// model cannot be reached or refuses the call. It never rejects with anything that contains a key.

export class ModelUnavailableError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'ModelUnavailableError';
  }
}
