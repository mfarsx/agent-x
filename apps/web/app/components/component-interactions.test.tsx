import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, KnownUser } from "@agent-social/db";
import { FEED_REFETCH_EVENT } from "../../lib/feed-events";

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ refresh: routerRefresh })),
}));

vi.mock("./feed-chrome-context", () => ({
  useFeedChrome: () => ({
    summary: null,
    onRefresh: null,
    setFeedChrome: vi.fn(),
    clearFeedChrome: vi.fn(),
    homeFeedFilter: { kind: "all" as const },
    setHomeFeedFilter: vi.fn(),
    homeFeedSearch: "",
    setHomeFeedSearch: vi.fn(),
  }),
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
      useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
      useRef: vi.fn((initial: unknown) => ({ current: initial })),
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

function requireElement(node: unknown, predicate: (node: ElementNode) => boolean): ElementNode {
  const element = findElement(node, predicate);
  expect(element).not.toBeNull();
  return element as ElementNode;
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
    counts: { likes: 0, reposts: 0, replies: 0 },
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
  it("submits valid content and signals feed refetch", async () => {
    const setters = mockReactState(["  hello graph  ", null, false]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const dispatchEventSpy = vi.fn(() => true);
    vi.stubGlobal("window", {
      dispatchEvent: dispatchEventSpy,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 0),
      clearInterval: vi.fn(),
    });
    const { Composer } = await import("./Composer");

    const form = Composer() as ElementNode;
    const preventDefault = vi.fn();
    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setters[1]).toHaveBeenCalledWith(null);
    expect(fetchMock).toHaveBeenCalledWith("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello graph" }),
    });
    expect(setters[0]).toHaveBeenCalledWith("");
    expect(dispatchEventSpy).toHaveBeenCalled();
    const raw = dispatchEventSpy.mock.calls.at(0)?.at(0);
    expect(raw).toBeDefined();
    expect((raw as unknown as Event).type).toBe(FEED_REFETCH_EVENT);
    expect(setters[2]).toHaveBeenNthCalledWith(1, true);
    expect(setters[2]).toHaveBeenLastCalledWith(false);
    vi.unstubAllGlobals();
  });

  it("submits reply content with a parentId and custom posted callback", async () => {
    const onPosted = vi.fn();
    const setters = mockReactState(["  reply body  ", null, false]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    const { Composer } = await import("./Composer");

    const form = Composer({ parentId: "post-1", onPosted }) as ElementNode;
    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "reply body", parentId: "post-1" }),
    });
    expect(setters[0]).toHaveBeenCalledWith("");
    expect(onPosted).toHaveBeenCalledOnce();
  });

  it("surfaces empty, API, and network errors", async () => {
    let setters = mockReactState(["   ", null, false]);
    let fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    let { Composer } = await import("./Composer");
    let form = Composer() as ElementNode;
    let preventDefault = vi.fn();

    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setters[1]).toHaveBeenCalledWith("empty_post");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setters[2]).not.toHaveBeenCalled();

    vi.resetModules();
    setters = mockReactState(["hello", null, false]);
    fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: "invalid_content" }) });
    vi.stubGlobal("fetch", fetchMock);
    ({ Composer } = await import("./Composer"));
    form = Composer() as ElementNode;
    preventDefault = vi.fn();
    await (form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(setters[1]).toHaveBeenLastCalledWith("invalid_content");

    vi.resetModules();
    setters = mockReactState(["hello", null, false]);
    fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
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
  function stubBrowserGlobals() {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 0),
      clearInterval: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("document", { visibilityState: "visible" as const });
  }

  it("loads the next feed page and records failures", async () => {
    stubBrowserGlobals();
    let setters = mockReactState([[itemFixture()], "cursor-1", false, false, null]);
    let fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [itemFixture({ id: "post-2" })], nextCursor: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { FeedShell } = await import("./FeedShell");

    let tree = FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;
    const loadMore = requireElement(
      tree,
      (node) => node.type === "button" && textOf(node) === "Load more",
    );

    await (loadMore.props?.onClick as () => Promise<void>)();
    expect(fetchMock).toHaveBeenCalledWith("/api/feed?cursor=cursor-1");
    expect(setters[3]).toHaveBeenNthCalledWith(1, true);
    const appendPage = setters[0].mock.calls.at(-1)?.[0] as (prev: FeedItem[]) => FeedItem[];
    expect(appendPage([itemFixture()]).map((item) => item.id)).toEqual(["post-1", "post-2"]);
    expect(setters[1]).toHaveBeenLastCalledWith(null);
    expect(setters[2]).toHaveBeenLastCalledWith(true);
    expect(setters[3]).toHaveBeenLastCalledWith(false);

    vi.resetModules();
    stubBrowserGlobals();
    setters = mockReactState([[itemFixture()], "cursor-1", false, false, null]);
    fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const module = await import("./FeedShell");
    tree = module.FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;
    await (
      requireElement(tree, (node) => node.type === "button" && textOf(node) === "Load more").props
        ?.onClick as () => Promise<void>
    )();
    expect(fetchMock).toHaveBeenCalledWith("/api/feed?cursor=cursor-1");
    expect(setters[4]).toHaveBeenLastCalledWith("Could not load more posts. Please try again.");
  });

  it("renders the loading skeleton while a page is pending", async () => {
    stubBrowserGlobals();
    const setters = mockReactState([[itemFixture()], "cursor-1", false, true, null]);
    const { FeedShell } = await import("./FeedShell");

    const tree = FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;
    expect(textOf(tree)).toContain("Loading…");
    expect(setters).toHaveLength(5);
  });

  it("handles thrown load-more failures", async () => {
    stubBrowserGlobals();
    const setters = mockReactState([[itemFixture()], "cursor-1", false, false, null]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { FeedShell } = await import("./FeedShell");

    const tree = FeedShell({
      initialFeed: [itemFixture()],
      initialCursor: "cursor-1",
    }) as ElementNode;

    await (
      requireElement(tree, (node) => node.type === "button" && textOf(node) === "Load more").props
        ?.onClick as () => Promise<void>
    )();
    expect(setters[4]).toHaveBeenLastCalledWith("Could not load more posts. Please try again.");
  });
});

describe("ProfileShell interactions", () => {
  function profileFixture() {
    return {
      handle: "scout_ai",
      name: "Scout",
      image: null,
      isAgent: true,
      bio: "Agent profile",
      joinedAt: "2026-01-01T00:00:00.000Z",
      viewer: { following: false },
      stats: {
        posts: 1,
        replies: 0,
        likesGiven: 0,
        repostsGiven: 0,
        followers: 2,
        following: 1,
      },
    };
  }

  function stubProfileGlobals() {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 0),
      clearInterval: vi.fn(),
      location: { origin: "http://localhost" },
    });
    vi.stubGlobal("document", { visibilityState: "visible" as const });
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  }

  it("updates follow state and copies profile links", async () => {
    stubProfileGlobals();
    const setters = mockReactState(["posts", [], null, false, false, null, false, 2, null, null]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ active: true, followers: 3 }) });
    vi.stubGlobal("fetch", fetchMock);
    const { ProfileShell } = await import("./ProfileShell");

    const tree = ProfileShell({
      profile: profileFixture(),
      initialFeed: [],
      initialCursor: null,
      initialActivity: { likes: [], reposts: [] },
      currentHandle: "fatih",
      authenticated: true,
    }) as ElementNode;

    await (
      requireElement(tree, (node) => textOf(node) === "Follow").props
        ?.onClick as () => Promise<void>
    )();
    await fetchMock.mock.results.at(-1)?.value;
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/scout_ai/follow", { method: "POST" });
    expect(setters[6]).toHaveBeenLastCalledWith(true);
    expect(setters[7]).toHaveBeenLastCalledWith(3);

    await (
      requireElement(tree, (node) => node.props?.["aria-label"] === "Copy profile link").props
        ?.onClick as () => Promise<void>
    )();
    await Promise.resolve();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost/u/scout_ai");
    expect(setters[9]).toHaveBeenCalledWith("Profile link copied.");
  });
});

describe("PostCard interactions", () => {
  it("updates local like state from the API and handles failures", async () => {
    let setters = mockReactState([false, false, 0, 0, false, null, null]);
    let fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ active: true, count: 3 }) });
    vi.stubGlobal("fetch", fetchMock);
    const { PostCard } = await import("./PostCard");

    let tree = PostCard({ item: itemFixture() }) as ElementNode;
    const like = requireElement(tree, (node) => node.props?.["aria-label"] === "Like post");
    await (like.props?.onClick as () => Promise<void>)();

    expect(fetchMock).toHaveBeenCalledWith("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1" }),
    });
    expect(setters[0]).toHaveBeenCalledWith(true);
    expect(setters[2]).toHaveBeenCalledWith(3);
    expect(setters[5]).toHaveBeenLastCalledWith(null);

    vi.resetModules();
    setters = mockReactState([false, false, 0, 0, false, null, null]);
    fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const module = await import("./PostCard");
    tree = module.PostCard({ item: itemFixture() }) as ElementNode;
    await (
      requireElement(tree, (node) => node.props?.["aria-label"] === "Like post").props
        ?.onClick as () => Promise<void>
    )();
    expect(setters[6]).toHaveBeenCalledWith("Action failed. Please try again.");
  });

  it("updates repost state and handles network errors", async () => {
    let setters = mockReactState([false, false, 0, 0, false, null, null]);
    let fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ active: true, count: 4 }) });
    vi.stubGlobal("fetch", fetchMock);
    const { PostCard } = await import("./PostCard");

    let tree = PostCard({ item: itemFixture() }) as ElementNode;
    await (
      requireElement(tree, (node) => node.props?.["aria-label"] === "Repost").props
        ?.onClick as () => Promise<void>
    )();

    expect(fetchMock).toHaveBeenCalledWith("/api/reposts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1" }),
    });
    expect(setters[1]).toHaveBeenCalledWith(true);
    expect(setters[3]).toHaveBeenCalledWith(4);

    vi.resetModules();
    setters = mockReactState([false, false, 0, 0, false, null, null]);
    fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const module = await import("./PostCard");
    tree = module.PostCard({ item: itemFixture() }) as ElementNode;
    await (
      requireElement(tree, (node) => node.props?.["aria-label"] === "Repost").props
        ?.onClick as () => Promise<void>
    )();

    expect(setters[6]).toHaveBeenCalledWith("Action failed. Please try again.");
  });
});

describe("ThreadShell interactions", () => {
  it("refreshes the thread from the API when the reply composer reports success", async () => {
    const initial = {
      parent: null,
      post: itemFixture({ id: "post-1" }),
      replies: [],
    };
    const refreshed = {
      ...initial,
      replies: [itemFixture({ id: "reply-1", kind: "REPLY", content: "reply" })],
    };
    const setters = mockReactState([initial, null]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => refreshed });
    vi.stubGlobal("fetch", fetchMock);
    const { ThreadShell } = await import("./ThreadShell");

    const tree = ThreadShell({ initialThread: initial }) as ElementNode;
    const composer = requireElement(
      tree,
      (node) => typeof node.type === "function" && node.type.name === "Composer",
    );
    (composer.props?.onPosted as () => void)();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("/api/posts/post-1/thread");
    expect(setters[0]).toHaveBeenCalledWith(refreshed);
    expect(setters[1]).toHaveBeenLastCalledWith(null);
  });
});

describe("HandleSwitcher interactions", () => {
  it("refreshes after successful identity changes and reverts failed changes", async () => {
    const users: KnownUser[] = [
      { handle: "fatih", name: "Fatih", isAgent: false },
      { handle: "scout_ai", name: "Scout", isAgent: true },
    ];
    let setters = mockReactState(["fatih"]);
    let fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { HandleSwitcher } = await import("./HandleSwitcher");

    let selector = HandleSwitcher({ initialHandle: "fatih", users }) as ElementNode;
    await (selector.props?.onHandleChange as (handle: string) => Promise<void>)("scout_ai");

    expect(fetchMock).toHaveBeenCalledWith("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "scout_ai" }),
    });
    expect(setters[0]).toHaveBeenCalledWith("scout_ai");
    expect(routerRefresh).toHaveBeenCalled();

    vi.resetModules();
    routerRefresh.mockClear();
    setters = mockReactState(["fatih"]);
    fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const module = await import("./HandleSwitcher");
    selector = module.HandleSwitcher({ initialHandle: "fatih", users }) as ElementNode;
    await (selector.props?.onHandleChange as (handle: string) => Promise<void>)("scout_ai");

    expect(setters[0]).toHaveBeenLastCalledWith("fatih");
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("web UI smoke: critical social actions", () => {
  it("covers posting, engagement, thread navigation, and reply refresh contracts", async () => {
    const dispatchEventSpy = vi.fn(() => true);
    vi.stubGlobal("window", {
      dispatchEvent: dispatchEventSpy,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 0),
      clearInterval: vi.fn(),
      location: { origin: "http://localhost" },
    });

    let setters = mockReactState(["  smoke post  ", null, false]);
    let fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    let { Composer } = await import("./Composer");

    await (
      (Composer() as ElementNode).props?.onSubmit as (event: {
        preventDefault: () => void;
      }) => Promise<void>
    )({ preventDefault: vi.fn() });

    expect(fetchMock).toHaveBeenCalledWith("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "smoke post" }),
    });
    expect(setters[0]).toHaveBeenCalledWith("");
    const refetchEvent = dispatchEventSpy.mock.calls.at(0)?.at(0) as unknown as Event;
    expect(refetchEvent.type).toBe(FEED_REFETCH_EVENT);

    vi.resetModules();
    const smokeItem = itemFixture({
      id: "smoke-post",
      content: "smoke post",
      counts: { likes: 0, reposts: 0, replies: 0 },
    });
    setters = mockReactState([false, false, 0, 0, false, null, null]);
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ active: true, count: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ active: true, count: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const { PostCard } = await import("./PostCard");
    const postCard = PostCard({ item: smokeItem }) as ElementNode;

    await (
      requireElement(postCard, (node) => node.props?.["aria-label"] === "Like post").props
        ?.onClick as () => Promise<void>
    )();
    await (
      requireElement(postCard, (node) => node.props?.["aria-label"] === "Repost").props
        ?.onClick as () => Promise<void>
    )();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "smoke-post" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/reposts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "smoke-post" }),
    });
    expect(setters[0]).toHaveBeenCalledWith(true);
    expect(setters[1]).toHaveBeenCalledWith(true);
    expect(setters[2]).toHaveBeenCalledWith(1);
    expect(setters[3]).toHaveBeenCalledWith(1);
    expect(
      requireElement(postCard, (node) => node.props?.["aria-label"] === "Open thread to reply")
        .props?.href,
    ).toBe("/post/smoke-post");

    vi.resetModules();
    const initialThread = { parent: null, post: smokeItem, replies: [] };
    const refreshedThread = {
      ...initialThread,
      replies: [itemFixture({ id: "smoke-reply", kind: "REPLY", content: "smoke reply" })],
    };
    setters = mockReactState([initialThread, null]);
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => refreshedThread });
    vi.stubGlobal("fetch", fetchMock);
    const { ThreadShell } = await import("./ThreadShell");
    const thread = ThreadShell({ initialThread }) as ElementNode;

    (
      requireElement(
        thread,
        (node) => typeof node.type === "function" && node.type.name === "Composer",
      ).props?.onPosted as () => void
    )();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("/api/posts/smoke-post/thread");
    expect(setters[0]).toHaveBeenCalledWith(refreshedThread);

    vi.resetModules();
    const onPosted = vi.fn();
    setters = mockReactState(["  smoke reply  ", null, false]);
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    ({ Composer } = await import("./Composer"));

    await (
      (Composer({ parentId: "smoke-post", onPosted }) as ElementNode).props?.onSubmit as (event: {
        preventDefault: () => void;
      }) => Promise<void>
    )({ preventDefault: vi.fn() });

    expect(fetchMock).toHaveBeenCalledWith("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "smoke reply", parentId: "smoke-post" }),
    });
    expect(setters[0]).toHaveBeenCalledWith("");
    expect(onPosted).toHaveBeenCalledOnce();
  });
});
