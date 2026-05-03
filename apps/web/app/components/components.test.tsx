import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, KnownUser } from "@agent-social/db";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ refresh: routerRefresh })),
}));

import { AppShell } from "./AppShell";
import { Brand } from "./Brand";
import { Composer } from "./Composer";
import { FeedShell } from "./FeedShell";
import { HandleSwitcher } from "./HandleSwitcher";
import { MobileHeader } from "./MobileHeader";
import { NavRail } from "./NavRail";
import { PostCard } from "./PostCard";
import { UserSelector } from "./UserSelector";

const users: KnownUser[] = [
  { handle: "fatih", name: "Fatih", isAgent: false },
  { handle: "scout_ai", name: "Scout", isAgent: true },
];

function render(children: ReactNode) {
  return renderToStaticMarkup(<>{children}</>);
}

function feedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "post-1",
    kind: "POST",
    content: "Hello from the graph",
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    author: {
      id: "u2",
      handle: "scout_ai",
      name: "Scout",
      image: null,
      isAgent: true,
    },
    parent: null,
    quotedPost: null,
    counts: { likes: 2, reposts: 1 },
    viewer: { liked: true, reposted: false },
    ...overrides,
  };
}

beforeEach(() => {
  routerRefresh.mockClear();
});

describe("web shell components", () => {
  it("renders the brand link", () => {
    const html = render(<Brand />);

    expect(html).toContain("Agent X");
    expect(html).toContain('href="/"');
  });

  it("renders navigation and mobile shell identity controls", () => {
    expect(render(<NavRail currentHandle="fatih" users={users} />)).toContain("Posting identity");
    expect(render(<MobileHeader currentHandle="fatih" users={users} />)).toContain("@scout_ai");
    expect(render(<HandleSwitcher initialHandle="fatih" users={users} />)).toContain("Posting as");
  });

  it("renders app shell pulse counts", () => {
    const html = render(
      <AppShell currentHandle="fatih" users={users}>
        <section>Timeline</section>
      </AppShell>,
    );

    expect(html).toContain("Timeline");
    expect(html).toContain("Agent network online");
    expect(html).toContain("agents");
    expect(html).toContain("humans");
  });
});

describe("feed components", () => {
  it("renders composer empty state controls", () => {
    const html = render(<Composer />);

    expect(html).toContain("Broadcast as current identity");
    expect(html).toContain("Post signal");
    expect(html).toContain("0/280");
  });

  it("renders an empty feed", () => {
    const html = render(<FeedShell initialFeed={[]} initialCursor={null} />);

    expect(html).toContain("Home timeline");
    expect(html).toContain("No posts yet");
  });

  it("renders feed summary and load more affordance", () => {
    const html = render(
      <FeedShell
        initialFeed={[
          feedItem({ id: "post-1", content: "same start one" }),
          feedItem({ id: "post-2", content: "same start one too" }),
        ]}
        initialCursor="cursor-1"
      />,
    );

    expect(html).toContain("2 visible");
    expect(html).toContain("Load more");
    expect(html).toContain("same start one");
  });

  it("renders post context, quoted content, fallback author, and active actions", () => {
    const html = render(
      <PostCard
        item={feedItem({
          kind: "QUOTE",
          author: { id: "u3", handle: null, name: null, image: null, isAgent: false },
          parent: {
            id: "parent-1",
            content: "parent",
            author: { handle: null, name: null, isAgent: false },
          },
          quotedPost: {
            id: "quoted-1",
            content: "quoted body",
            author: { handle: "ada", name: "Ada", isAgent: true },
          },
          viewer: { liked: true, reposted: true },
        })}
        deemphasize
      />,
    );

    expect(html).toContain("Unknown");
    expect(html).toContain("Quoted signal");
    expect(html).toContain("quoted body");
    expect(html).toContain("❤️");
    expect(html).toContain("🔄");
  });

  it("renders image avatars and day-level relative time", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-01-05T00:00:00.000Z").getTime());

    const html = render(
      <PostCard
        item={feedItem({
          createdAt: "2026-01-02T00:00:00.000Z",
          author: {
            id: "u2",
            handle: "scout_ai",
            name: "Scout",
            image: "https://example.test/avatar.png",
            isAgent: true,
          },
        })}
      />,
    );

    expect(html).toContain("avatar.png");
    expect(html).toContain("3d ago");
  });

  it("renders user selector labels in compact and full modes", () => {
    const onHandleChange = vi.fn();

    expect(
      render(<UserSelector handle="fatih" users={users} onHandleChange={onHandleChange} />),
    ).toContain("Posting as:");
    expect(
      render(<UserSelector handle="fatih" users={users} onHandleChange={onHandleChange} compact />),
    ).toContain("(agent)");
  });
});
