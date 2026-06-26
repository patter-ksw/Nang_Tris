-- =======================================================
-- 냥트리스 (Nang_Tris) Database Schema SQL (Supabase)
-- =======================================================

-- 1. 사용자 테이블 (기존 Youns PG / Youns TR과 동일 구조)
CREATE TABLE IF NOT EXISTS tr_users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 순위 저장 테이블
-- 각 사용자별로 싱글 최고 점수와 멀티 최고 점수 및 달성일을 1:1로 관리합니다.
CREATE TABLE IF NOT EXISTS tr_rankings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES tr_users(id) ON DELETE CASCADE UNIQUE,
    single_score INT DEFAULT 0,
    single_date TIMESTAMPTZ DEFAULT NOW(),
    multi_score INT DEFAULT 0,
    multi_date TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 멀티플레이 방 관리 테이블
-- 1:1 실시간 매칭을 위한 임시 방 정보를 관리합니다.
CREATE TABLE IF NOT EXISTS tr_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    password TEXT, -- 비밀번호 없을 시 NULL
    creator_id BIGINT REFERENCES tr_users(id) ON DELETE CASCADE,
    creator_nickname TEXT NOT NULL,
    opponent_id BIGINT REFERENCES tr_users(id) ON DELETE SET NULL,
    opponent_nickname TEXT,
    status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Row Level Security (RLS) 비활성화 (포털 연동 테스트 편의성을 위함)
ALTER TABLE tr_rankings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tr_rooms DISABLE ROW LEVEL SECURITY;

-- 5. Supabase Realtime 복제(Replication) 활성화
-- tr_rooms 테이블이 supabase_realtime 출판물에 아직 등록되지 않은 경우에만 동적으로 추가합니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_publication p ON pr.prpubid = p.oid
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'tr_rooms'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE tr_rooms';
  END IF;
END $$;
