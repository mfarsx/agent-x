import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, KnownUser } from "@agent-social/db";

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ refresh: routerRefresh })),
}));

type ElementNode = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

function mockReactState(values: unknown[]) {
  const setters: Array<ReturnType<typeof vi.fn>> = [];
  let index = 0;

  vi.doMock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {
      ...actual,
      useEffect: vi.fn((effect: () => void) => effect()),
      useState: vi.fn((initial: unknown) => {
        const setter = vi.fn();
        setters.push(setter);
        const value = index < values.length ? values[index] : initial;
        index += 1;
        return [value, setter];
      }),
    };
  });

  return setters;
}

function childrenOf(node: unknown): unknown[] {
  const children = (node as ElementNode | null)?.props?.children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? children : [children];
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textOf).join("");
}

function findElement(node: unknown, predicate: (node: ElementNode) => boolean): ElementNode | null {
  if (node && typeof node === "object") {
    const element = node as ElementNode;
    if (predicate(element)) return element;
    for (const child of childrenOf(element)) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

function itemFixture(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "post-1",
    kind: "POST",
    content: "Hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    author: { id: "u1", handle: "fatih", name: "Fatih", image: null, isAgent: false },
    parent: null,
    quotedPost: null,
    counts: { likes: 0, reposts: 0 },
    viewer: { liked: false, reposted: false },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  routerRefresh.mockClear();
});

describe("Composer interactions", () => {
  it("submits valid content and refreshes the router", async () => {
    const setters = mockReactState(["  hello graph  ", null, false]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const { Composer } = await import("./Composer");

    const form = Composer() as ElementNode;
    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault: vi.fn(),
    });

    expect(fetch).toHaveBeenCalledWith("/api/posts", expect.objectContaining({ method: "POST" }));
    expect(setters[0]).toHaveBeenCalledWith("");
    expect(routerRefresh).toHaveBeenCalled();
    expect(setters[2]).toHaveBeenNthCalledWith(1, true);
    expect(setters[2]).toHaveBeenLastCalledWith(false);
  });

  it("surfaces empty, API, and network errors", async () => {
    let setters = mockReactState(["   ", null, false]);
    let { Composer } = await import("./Composer");
    let form = Composer() as ElementNode;

    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault: vi.fn(),
    });
    expect(setters[1]).toHaveBeenCalledWith("empty_post");

    vi.resetModules();
    setters = mockReactState(["hello", null, false]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "invalid_content" }) }),
    );
    ({ Composer } = await import("./Composer"));
    form = Composer() as ElementNode;
    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault: vi.fn(),
    });
    expect(setters[1]).toHaveBeenLastCalledWith("invalid_content");

    vi.resetModules();
    setters = mockReactState(["hello", null, false]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    ({ Composer } = await import("./Composer"));
    form = Composer() as ElementNode;
    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault: vi.fn(),
    });
    expect(setters[1]).toHaveBeenLastCalledWith("network_error");
  });

  it("renders mapped and fallback error messages", async () => {
    let setters = mockReactState(["hello", "network_error", false]);
    let { Composer } = await import("./Composer");
    let form = Composer() as ElementNode;

    expect(textOf(form)).toContain("Network connection dropped");

    vi.resetModules();
    setters = mockReactState(["hello", "mystery_error", false]);
    ({ Composer } = await import("./Composer"));
    form = Composer() as ElementNode;

    expect(setters).toHaveLength(3);
    expect(textOf(form)).toContain("Something went wrong while publishing your post.");
  });
});

describe("FeedShell interactions", () => {
  it("loads the next feed page and records failures", async () => {
    let setters = mockReactState([[itemFixture()], "cursor-1", false, null]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [itemFixture({ id: "post-2" })], nextCursor: null }),
      }),
    );
    const { FeedShell } = await import("./FeedShell");

    let tree = FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;
    const loadMore = findElement(
      tree,
      (node) => node.type === "button" && textOf(node) === "Load more",
    );

    await (loadMore?.props?.onClick as () => Promise<void>)();
    expect(fetch).toHaveBeenCalledWith("/api/feed?cursor=cursor-1");
    expect(setters[2]).toHaveBeenNthCalledWith(1, true);
    expect(setters[0]).toHaveBeenLastCalledWith(expect.any(Function));
    expect(setters[1]).toHaveBeenLastCalledWith(null);
    expect(setters[2]).toHaveBeenLastCalledWith(false);

    vi.resetModules();
    setters = mockReactState([[itemFixture()], "cursor-1", false, null]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const module = await import("./FeedShell");
    tree = module.FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;
    await (
      findElement(tree, (node) => node.type === "button" && textOf(node) === "Load more")?.props
        ?.onClick as () => Promise<void>
    )();
    expect(setters[3]).toHaveBeenLastCalledWith("Could not load more posts. Please try again.");
  });

  it("renders the loading skeleton while a page is pending", async () => {
    const setters = mockReactState([[itemFixture()], "cursor-1", true, null]);
    const { FeedShell } = await import("./FeedShell");

    const tree = FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;
    expect(textOf(tree)).toContain("Loading…");
    expect(setters).toHaveLength(4);
  });

  it("handles thrown load-more failures", async () => {
    const setters = mockReactState([[itemFixture()], "cursor-1", false, null]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { FeedShell } = await import("./FeedShell");

    const tree = FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;

    await (
      findElement(tree, (node) => node.type === "button" && textOf(node) === "Load more")?.props
        ?.onClick as () => Promise<void>
    )();
    expect(setters[3]).toHaveBeenLastCalledWith("Could not load more posts. Please try again.");
  });
});

describe("PostCard interactions", () => {
  it("updates local like state from the API and handles failures", async () => {
    let setters = mockReactState([false, false, 0, 0, null, null]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ active: true, count: 3 }) }),
    );
    const { PostCard } = await import("./PostCard");

    let tree = PostCard({ item: itemFixture() }) as ElementNode;
    const like = findElement(tree, (node) => node.props?.["aria-label"] === "Like post");
    await (like?.props?.onClick as () => Promise<void>)();

    expect(fetch).toHaveBeenCalledWith("/api/likes", expect.objectContaining({ method: "POST" }));
    expect(setters[0]).toHaveBeenCalledWith(true);
    expect(setters[2]).toHaveBeenCalledWith(3);
    expect(setters[4]).toHaveBeenLastCalledWith(null);

    vi.resetModules();
    setters = mockReactState([false, false, 0, 0, null, null]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const module = await import("./PostCard");
    tree = module.PostCard({ item: itemFixture() }) as ElementNode;
    await (
      findElement(tree, (node) => node.props?.["aria-label"] === "Like post")?.props
        ?.onClick as () => Promise<void>
    )();
    expect(setters[5]).toHaveBeenCalledWith("Action failed. Please try again.");
  });

  it("updates repost state and handles network errors", async () => {
    let setters = mockReactState([false, false, 0, 0, null, null]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ active: true, count: 4 }) }),
    );
    const { PostCard } = await import("./PostCard");

    let tree = PostCard({ item: itemFixture() }) as ElementNode;
    await (
      findElement(tree, (node) => node.props?.["aria-label"] === "Repost")?.props
        ?.onClick as () => Promise<void>
    )();

    expect(fetch).toHaveBeenCalledWith("/api/reposts", expect.objectContaining({ method: "POST" }));
    expect(setters[1]).toHaveBeenCalledWith(true);
    expect(setters[3]).toHaveBeenCalledWith(4);

    vi.resetModules();
    setters = mockReactState([false, false, 0, 0, null, null]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const module = await import("./PostCard");
    tree = module.PostCard({ item: itemFixture() }) as ElementNode;
    await (
      findElement(tree, (node) => node.props?.["aria-label"] === "Repost")?.props
        ?.onClick as () => Promise<void>
    )();

    expect(setters[5]).toHaveBeenCalledWith("Action failed. Please try again.");
  });
});

describe("HandleSwitcher interactions", () => {
  it("refreshes after successful identity changes and reverts failed changes", async () => {
    const users: KnownUser[] = [
      { handle: "fatih", name: "Fatih", isAgent: false },
      { handle: "scout_ai", name: "Scout", isAgent: true },
    ];
    let setters = mockReactState(["fatih"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const { HandleSwitcher } = await import("./HandleSwitcher");

    let selector = HandleSwitcher({ initialHandle: "fatih", users }) as ElementNode;
    await (selector.props?.onHandleChange as (handle: string) => Promise<void>)("scout_ai");

    expect(setters[0]).toHaveBeenCalledWith("scout_ai");
    expect(routerRefresh).toHaveBeenCalled();

    vi.resetModules();
    routerRefresh.mockClear();
    setters = mockReactState(["fatih"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const module = await import("./HandleSwitcher");
    selector = module.HandleSwitcher({ initialHandle: "fatih", users }) as ElementNode;
    await (selector.props?.onHandleChange as (handle: string) => Promise<void>)("scout_ai");

    expect(setters[0]).toHaveBeenLastCalledWith("fatih");
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
