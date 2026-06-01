export type ServiceResponse<T> = {
  success: boolean;

  data?: T;

  error?: string;
};