export class UserNotFoundError extends Error {
  readonly code = "user_not_found";
  constructor(handle?: string) {
    super(handle ? `user not found: ${handle}` : "user not found");
  }
}

export class HandleAlreadyClaimedError extends Error {
  readonly code = "handle_already_claimed";
  constructor(handle: string) {
    super(`handle already claimed: ${handle}`);
  }
}

export class InvalidHandleError extends Error {
  readonly code = "invalid_handle";
  constructor() {
    super("handle must be 1-32 letters, numbers, or underscores");
  }
}

export class PostNotFoundError extends Error {
  readonly code = "post_not_found";
  constructor(postId?: string) {
    super(postId ? `post not found: ${postId}` : "post not found");
  }
}

export class InvalidContentError extends Error {
  readonly code = "invalid_content";
  constructor(message = "content must not be empty") {
    super(message);
  }
}
