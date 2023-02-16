export interface PostData {
  pid: number,
  uid: number
}

export interface ToggleData {
  post: PostData,
  isEndorsed: boolean
}

export enum Action {
  ENDORSE,
  UNENDORSE
}

export interface UserData {
  accounttype: string
}
