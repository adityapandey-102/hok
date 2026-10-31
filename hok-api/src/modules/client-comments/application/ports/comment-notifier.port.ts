/** M9 hook: tell the client's manager about a new portal comment (bell + web push). Never throws. */
export interface CommentNotifier {
  newClientComment(notice: { recipientIds: string[]; clientId: string; clientName: string; commentId: string; body: string }): Promise<void>;
}

export const NO_COMMENT_NOTIFIER: CommentNotifier = { newClientComment: async () => {} };
