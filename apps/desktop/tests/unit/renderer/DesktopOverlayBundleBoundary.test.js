import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appOverlaysSource = readFileSync(
  resolve(process.cwd(), "src/renderer/app/AppOverlays.jsx"),
  "utf8",
);

const searchModalSource = readFileSync(
  resolve(process.cwd(), "src/renderer/components/modals/SearchModal.jsx"),
  "utf8",
);

describe("Desktop optional overlay bundle boundaries", () => {
  it("loads Smart Connect presentation only when the modal is requested", () => {
    expect(appOverlaysSource).toContain(
      'lazy(() => import("../components/modals/SmartConnectModal"))',
    );
    expect(appOverlaysSource).not.toMatch(
      /import\s+SmartConnectModal\s+from\s+["'][^"']+["']/,
    );
    expect(appOverlaysSource).toMatch(
      /model\.showConnectModal[\s\S]*<Suspense[\s\S]*<SmartConnectModal/,
    );
  });

  it("loads Search presentation on first use and keeps it mounted for its exit lifecycle", () => {
    expect(appOverlaysSource).toContain(
      'lazy(() => import("../components/modals/SearchModal"))',
    );
    expect(appOverlaysSource).not.toMatch(
      /import\s+SearchModal\s+from\s+["'][^"']+["']/,
    );
    expect(appOverlaysSource).toContain(
      "const [searchPresentationActivated, setSearchPresentationActivated] = useState(showSearch);",
    );
    expect(appOverlaysSource).toMatch(
      /if \(showSearch\) setSearchPresentationActivated\(true\)/,
    );
    expect(appOverlaysSource).toMatch(
      /\{\(showSearch \|\| searchPresentationActivated\) && \([\s\S]*<Suspense[\s\S]*<SearchModal[\s\S]*isOpen=\{showSearch\}/,
    );
    expect(searchModalSource).toContain(
      "const [shouldRender, setShouldRender] = useState(isOpen);",
    );
    expect(searchModalSource).toMatch(
      /setAnimState\("exiting"\)[\s\S]*setShouldRender\(false\)[\s\S]*}, 300\)/,
    );
  });
  it("loads the update-install presentation only when the update modal is requested", () => {
    expect(appOverlaysSource).toContain(
      'lazy(() => import("../components/UpdateModal"))',
    );
    expect(appOverlaysSource).not.toMatch(
      /import\s+UpdateModal\s+from\s+["'][^"']+["']/,
    );
    expect(appOverlaysSource).toMatch(
      /showUpdateModal && updateBanner[\s\S]*<Suspense[\s\S]*<UpdateModal/,
    );
  });

});
