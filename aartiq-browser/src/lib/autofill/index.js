const { AutofillProfileService } = require('./AutofillProfileService');
const { matchField, matchFields, buildAssignJS } = require('./FormFieldMatcher');
const { extractPageElementsCode, fillFormCode } = require('./injector');

module.exports = {
  AutofillProfileService,
  matchField,
  matchFields,
  buildAssignJS,
  extractPageElementsCode,
  fillFormCode,
};
