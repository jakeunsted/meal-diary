export class InvalidRecipeImportUrlError extends Error {
  constructor(message = 'Invalid recipe URL') {
    super(message);
    this.name = 'InvalidRecipeImportUrlError';
  }
}

export class RecipeImportParseError extends Error {
  constructor(message = 'Failed to parse recipe from URL') {
    super(message);
    this.name = 'RecipeImportParseError';
  }
}

export class UnsupportedRecipeImportSiteError extends RecipeImportParseError {
  constructor(message = "This site isn't supported") {
    super(message);
    this.name = 'UnsupportedRecipeImportSiteError';
  }
}
