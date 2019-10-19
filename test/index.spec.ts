import * as fs from "fs";
import * as path from "path";
import finder from "../src";

function check(selector: string, result: ReturnType<typeof finder>) {
  expect(finder(document.querySelector(selector)!)).toEqual(result);
}

describe("content finder", () => {
  beforeAll(() => {
    document.open();
    document.write(
      fs.readFileSync(path.resolve(__dirname, "./fixture/test.html"), "utf8")
    );
    document.close();
  });

  it("use unique tagname", () => {
    check("ul", [{ name: "ul", content: null }]);
  });

  it("use unique class name", () => {
    check(".c1", [{ name: ".c1", content: null }]);
    check("div:nth-of-type(2)", [{ name: ".c2", content: null }]);
  });

  it("use unique fragment stack", () => {
    check("p", [{ name: "ul", content: null }, { name: "p", content: null }]);
  });

  it("use content as part of the selector", () => {
    check("li:nth-of-type(4) > span", [{ name: "span", content: "different" }]);
  });

  it("use content as part of the selector at any level", () => {
    check("li:nth-of-type(3) > span", [
      {
        name: "li",
        content: `
        aa
        same
      `
      },
      { name: "span", content: null }
    ]);
  });

  it("use nth child as a fallback", () => {
    check("li:nth-of-type(2) > span", [
      {
        name: "li:nth-child(2)",
        content: null
      },
      { name: "span", content: null }
    ]);
  });

  afterAll(() => {
    document.clear();
  });
});
