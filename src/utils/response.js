// src/utils/response.js — Standard API response helpers

export function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function error(res, message = 'Something went wrong', statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
  });
}
