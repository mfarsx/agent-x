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

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: routerRefresh })),
}));

vi.mock("./feed-chrome-context", () => ({
  FeedChromeProvider: ({ children }: { children: ReactNode }) => children,
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

import { AppShell } from "./AppShell";
import { Brand } from "./Brand";
import { Composer } from "./Composer";
import { FeedShell } from "./FeedShell";
import { HandleSwitcher } from "./HandleSwitcher";
import { HandleClaimPanel } from "../onboarding/handle/handle-claim-panel";
import { MobileHeader } from "./MobileHeader";
import { NavRail } from "./NavRail";
import { PostCard } from "./PostCard";
import { ProfileShell } from "./ProfileShell";
import { ThreadShell } from "./ThreadShell";
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
    counts: { likes: 2, reposts: 1, replies: 0 },
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

    expect(html).toContain('<a href="/"');
    expect(html).toContain('aria-hidden="true">AX</span>');
    expect(html).toContain("Agent X");
  });

  it("renders navigation and mobile shell identity controls", () => {
    const navHtml = render(
      <NavRail
        authenticated
        currentHandle="fatih"
        demoIdentityEnabled
        operatorUiEnabled={false}
        users={users}
      />,
    );
    const mobileHtml = render(
      <MobileHeader
        authenticated
        currentHandle="fatih"
        demoIdentityEnabled
        operatorUiEnabled={false}
        users={users}
      />,
    );
    const switcherHtml = render(<HandleSwitcher initialHandle="fatih" users={users} />);

    expect(navHtml).toContain('aria-label="Primary"');
    expect(navHtml).toContain('aria-current="page"');
    expect(navHtml).toContain("Posting identity");
    expect(navHtml).toContain("Sign out");
    expect(mobileHtml).toContain("Agent X");
    expect(mobileHtml).toContain("@scout_ai");
    expect(switcherHtml).toContain('aria-label="Posting as"');
    expect(switcherHtml).toContain('<option value="fatih" selected="">@fatih</option>');
  });

  it("renders app shell pulse counts", () => {
    const html = render(
      <AppShell
        authenticated
        currentHandle="fatih"
        demoIdentityEnabled
        operatorUiEnabled={false}
        users={users}
      >
        <section>Timeline</section>
      </AppShell>,
    );

    expect(html).toContain("Timeline");
    expect(html).toContain("Agent network online");
    expect(html).toContain("agents");
    expect(html).toContain("humans");
  });

  it("hides demo identity controls when demo identity is disabled", () => {
    const navHtml = render(
      <NavRail
        authenticated={false}
        currentHandle="fatih"
        demoIdentityEnabled={false}
        operatorUiEnabled={false}
        users={users}
      />,
    );
    const mobileHtml = render(
      <MobileHeader
        authenticated={false}
        currentHandle="fatih"
        demoIdentityEnabled={false}
        operatorUiEnabled={false}
        users={users}
      />,
    );

    expect(navHtml).toContain("Posting identity");
    expect(navHtml).toContain("Sign in");
    expect(navHtml).not.toContain('aria-label="Posting as"');
    expect(mobileHtml).toContain("Agent X");
    expect(mobileHtml).not.toContain('aria-label="Posting as"');
  });

  it("renders the handle claiming onboarding form", () => {
    const html = render(<HandleClaimPanel suggestedHandle="New User@example.com" />);

    expect(html).toContain("Claim your Agent X handle");
    expect(html).toContain('value="new_user"');
    expect(html).toContain('pattern="[a-zA-Z0-9_]{1,32}"');
    expect(html).toContain("Claim handle");
    expect(html).toContain("Use 1–32 letters, numbers, or underscores.");
  });
});

describe("feed components", () => {
  it("renders composer empty state controls", () => {
    const html = render(<Composer />);

    expect(html).toContain("Broadcast as current identity");
    expect(html).toContain('aria-label="Post content"');
    expect(html).toContain('aria-label="Composer context"');
    expect(html).toContain("Post signal");
    expect(html).toContain("disabled");
    expect(html).toContain("0/280");
  });

  it("renders an empty feed", () => {
    const html = render(<FeedShell initialFeed={[]} initialCursor={null} />);

    expect(html).toContain("Home");
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

    expect(html).toContain("Load more");
    expect(html).toContain("same start one");
  });

  it("renders profile actions and follower stats", () => {
    const html = render(
      <ProfileShell
        profile={{
          handle: "scout_ai",
          name: "Scout",
          image: null,
          isAgent: true,
          bio: "Agent profile",
          joinedAt: "2026-01-01T00:00:00.000Z",
          viewer: { following: false },
          stats: {
            posts: 4,
            replies: 1,
            likesGiven: 2,
            repostsGiven: 3,
            followers: 5,
            following: 6,
          },
        }}
        initialFeed={[]}
        initialCursor={null}
        initialActivity={{ likes: [], reposts: [] }}
        currentHandle="fatih"
        authenticated
      />,
    );

    expect(html).toContain("Scout");
    expect(html).toContain("Agent profile");
    expect(html).toContain("Follow");
    expect(html).toContain('aria-label="Copy profile link"');
    expect(html).toContain("5</strong> followers");
    expect(html).toContain("6</strong> following");
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
    expect(html).toContain("@unknown");
    expect(html).toContain("Quote");
    expect(html).toContain("Replying to");
    expect(html).toContain("Quoted signal");
    expect(html).toContain("quoted body");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Unlike post"');
    expect(html).toContain('aria-label="Undo repost"');
    expect(html).toContain('aria-label="Open thread to reply"');
    expect(html).toContain('href="/post/post-1"');
    expect(html).toContain('aria-label="Views not tracked yet"');
    expect(html).toContain("<svg");
  });

  it("renders a thread with a reply composer and replies", () => {
    const html = render(
      <ThreadShell
        initialThread={{
          parent: feedItem({ id: "parent-1", content: "Parent post" }),
          post: feedItem({
            id: "post-1",
            content: "Thread root",
            counts: { likes: 0, reposts: 0, replies: 1 },
          }),
          replies: [feedItem({ id: "reply-1", kind: "REPLY", content: "Reply body" })],
        }}
      />,
    );

    expect(html).toContain("Thread");
    expect(html).toContain("Parent post");
    expect(html).toContain("Thread root");
    expect(html).toContain("Reply body");
    expect(html).toContain("Replying to @scout_ai");
    expect(html).toContain("Reply");
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
    const compactHtml = render(
      <UserSelector handle="fatih" users={users} onHandleChange={onHandleChange} compact />,
    );
    expect(compactHtml).not.toContain("Posting as:");
    expect(compactHtml).toContain('<option value="scout_ai">@scout_ai (agent)</option>');
  });
});
