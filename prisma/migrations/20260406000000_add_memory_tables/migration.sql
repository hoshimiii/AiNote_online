-- 启用 pgvector 扩展（需要 PostgreSQL 13+ 并已安装 pgvector）
-- 安装方式：https://github.com/pgvector/pgvector#installation
CREATE EXTENSION IF NOT EXISTS vector;

-- ConversationMemory 表：存储对话记忆向量
CREATE TABLE "ConversationMemory" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "summary"   TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("id")
);

-- NoteEmbedding 表：存储笔记块向量
CREATE TABLE "NoteEmbedding" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "noteId"       TEXT NOT NULL,
    "blockContent" TEXT NOT NULL,
    "embedding"    vector(1024),
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteEmbedding_pkey" PRIMARY KEY ("id")
);

-- 索引
CREATE INDEX "ConversationMemory_userId_idx"  ON "ConversationMemory"("userId");
CREATE INDEX "ConversationMemory_sessionId_idx" ON "ConversationMemory"("sessionId");
CREATE INDEX "NoteEmbedding_userId_idx"       ON "NoteEmbedding"("userId");
CREATE INDEX "NoteEmbedding_noteId_idx"       ON "NoteEmbedding"("noteId");

-- IVFFlat 向量索引（余弦距离，适合中小规模数据量）
-- 注：首次创建时表须有数据，或在插入足量数据后再执行以下语句
-- CREATE INDEX "ConversationMemory_embedding_idx"
--     ON "ConversationMemory" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX "NoteEmbedding_embedding_idx"
--     ON "NoteEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- 外键约束
ALTER TABLE "ConversationMemory"
    ADD CONSTRAINT "ConversationMemory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoteEmbedding"
    ADD CONSTRAINT "NoteEmbedding_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
