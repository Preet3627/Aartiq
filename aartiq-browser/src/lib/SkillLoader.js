const SkillLoader = require('./SkillLoader.ts').default || require('./SkillLoader.ts');
module.exports = { skillLoader: SkillLoader.getInstance() };
