-- Resize AgentMemory.embedding to match nomic-embed-text (768 dims)
-- Existing embedding values are dropped (none expected — column was never populated).
ALTER TABLE "AgentMemory"
  ALTER COLUMN "embedding" TYPE vector(768) USING NULL;

-- Cosine-similarity index for semantic memory retrieval.
CREATE INDEX IF NOT EXISTS "AgentMemory_embedding_cosine_idx"
  ON "AgentMemory"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
