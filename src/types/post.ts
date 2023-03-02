import { CategoryObject } from './category';
import { TopicObject } from './topic';
import { UserObjectSlim } from './user';

export type PostObject = {
  pid: number | string;
  tid: number | string;
  content: string;
  uid: number | string;
  timestamp: number;
  deleted: boolean | number;
  upvotes: number;
  downvotes: number;
  votes: number;
  timestampISO: string;
  user: UserObjectSlim;
  topic: TopicObject;
  category: CategoryObject;
  isMainPost: boolean;
  replies: number;
  deleterUid?: number;
  cid: number | string;
  toPid?: number | string;
  flagId?: string;
};
