// 跨 core / backend / extension 共用型別（原 src/shared/types.ts）

export interface Persona {
  handle: string;
  display_name: string;
  brand: {
    purpose: string;
    voice: string;
    audience: { age_range: string; interests: string[] };
  };
  style_fingerprint: {
    avg_sentence_len: number;
    emoji_frequency: "none" | "low" | "medium" | "high";
    common_emojis: string[];
    signature_phrases: string[];
    tone_markers: string[];
    formatting: { use_hashtags: boolean; max_hashtags: number; use_line_breaks: boolean };
  };
  reply_habits: {
    length: "short" | "medium" | "long";
    always_acknowledge_original: boolean;
    emoji_in_reply: boolean;
    never_hard_sell: boolean;
  };
}

export interface BusinessRules {
  hard_rules: string[];
  soft_rules: string[];
  popular_criteria: {
    min_likes: number;
    min_replies: number;
    max_post_age_hours: number;
    min_author_followers: number;
    scout_target_per_keyword: number;
    topic_keywords: string[];
    exclude_keywords: string[];
  };
  safety: {
    require_human_approval_before_send: boolean;
    max_replies_per_session: number;
    cooldown_minutes_between_replies: [number, number];
  };
}

/** 海巡抓到的候選貼文 */
export interface ScoutedPost {
  id: string;
  url: string;
  author_handle: string;
  author_followers: number | null;
  text: string;
  likes: number;
  replies: number;
  posted_at: string; // ISO
  thread_excerpt: string[]; // 既有留言串氣氛取樣
  is_popular: boolean;
  popular_reason: string;
}

export type ReviewStatus = "pending" | "approved" | "rejected" | "edited" | "sent" | "failed";

/** 進入人審佇列的一筆草稿 */
export interface ReviewItem {
  id: string;
  kind: "post" | "reply";
  target_post?: ScoutedPost; // reply 才有
  draft: string;
  edited_draft?: string;
  recommend_reason: string;
  rule_flags: string[]; // 命中 hard_rule 的項目；非空代表不可送
  status: ReviewStatus;
  created_at: string;
  reviewed_at?: string;
  sent_at?: string;
}

export interface SessionStats {
  session_id: string;
  started_at: string;
  posts_viewed: number;
  replies_sent: number;
  approvals: number;
  rejections: number;
  detection_signals: string[]; // 登入挑戰 / captcha / 錯誤碼
}
