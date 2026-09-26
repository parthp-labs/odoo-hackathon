import { baseApi } from './baseApi'

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Backend: POST /api/auth/login -> { success: true, token, user }
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    // Backend: POST /api/auth/register -> { success: true, message, email, requiresVerification: true }
    signup: builder.mutation({
      query: ({ name, email, password, role }) => ({
        url: '/auth/register',
        method: 'POST',
        body: { name, email, password, role },
      }),
    }),

    // Backend: POST /api/auth/verify-email -> expects { email, otp_code }
    // Frontend UI sends { email, otp }
    verifyEmail: builder.mutation({
      query: ({ email, otp, otp_code }) => ({
        url: '/auth/verify-email',
        method: 'POST',
        body: {
          email,
          otp_code: otp_code || otp,
        },
      }),
    }),

    // Backend: POST /api/auth/resend-otp -> expects { email, purpose }
    resendOtp: builder.mutation({
      query: ({ email, purpose }) => ({
        url: '/auth/resend-otp',
        method: 'POST',
        body: { email, purpose },
      }),
    }),

    // Backend: POST /api/auth/forgot-password -> expects { email }
    forgotPassword: builder.mutation({
      query: ({ email }) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: { email },
      }),
    }),

    // Backend: POST /api/auth/reset-password -> expects { email, otp_code, new_password }
    // Frontend UI sends { email, otp, password }
    resetPassword: builder.mutation({
      query: ({ email, otp, otp_code, password, new_password }) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: {
          email,
          otp_code: otp_code || otp,
          new_password: new_password || password,
        },
      }),
    }),

    // Backend: GET /api/auth/me -> { success: true, user: { ... } }
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['User'],
      transformResponse: (response) => response.user || response,
    }),
  }),
})

export const {
  useLoginMutation,
  useSignupMutation,
  useVerifyEmailMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetMeQuery,
} = authApi
