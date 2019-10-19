module.exports = {
  transform: {
    ".ts": "ts-jest"
  },

  globals: {
    "ts-jest": {
      diagnostics: false
    }
  },

  moduleFileExtensions: ["ts", "js"],

  testMatch: ["<rootDir>/test/**/**.spec.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/lib/", "<rootDir>/lib/"]
};
