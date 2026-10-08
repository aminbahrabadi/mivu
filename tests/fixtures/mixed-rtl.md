# راهنمای مستندات دو زبانه

Event Service بین برنامه و سرویس‌های دیگر قرار دارد. پیام‌ها را به صورت event دریافت می‌کند و به provider مناسب می‌فرستد. خواندن این توضیح فارسی باید از سمت راست آغاز شود.

Kafka پیام‌ها را در یک consumer group مستقل نگه می‌دارد. نتیجهٔ هر درخواست بررسی می‌شود و سپس offset به‌روزرسانی می‌شود.

This English paragraph includes a short Persian phrase, «فقط بخوانید», and continues in English with its own left-to-right layout.

## موارد مهم

- DLQ نداریم.
- delivery دقیقاً یک‌بار تضمین نمی‌شود و duplicate ممکن است.
- consumerها liveness/readiness probe واقعی ندارند.
- malformed eventها skip و commit می‌شوند.
- `auto_offset_reset=latest` باعث می‌شود پیام‌های قبلی خودکار خوانده نشوند.
- [Kafka docs](https://example.org/kafka) برای بررسی جزئیات بیشتر در دسترس است.

1. Retry درخواست ناموفق را دوباره ارسال می‌کند.
2. HTTP پاسخ مناسب را به برنامه برمی‌گرداند.

## فهرست تو در تو

- English parent stays left-to-right.
  - API در این بخش توضیح داده شده است.
  - Kafka پیام‌ها را دریافت می‌کند.
- سرویس آماده است.
  - English child keeps its own direction.

## نقل قول

> API برای خواندن مستندات در دسترس است و توضیح فارسی از راست آغاز می‌شود.

## کد و پیوند

`consumer group --reset-offsets --to-earliest` برای اجرای دستور استفاده می‌شود و توضیح فارسی از سمت راست خوانده می‌شود.

https://example.org/a/very/long/technical/documentation/path راهنمای فارسی است و متن فارسی باید جهت درست داشته باشد.

از `pnpm build` و دستور `mivu 'سلام world.md'` استفاده کنید. نسخهٔ ۰٫۱٫۰ و عدد 2026 باید خوانا باقی بمانند.

```bash
# توضیح فارسی داخل کد، جهت دستور را تغییر نمی‌دهد.
printf '%s\n' 'سلام world'
```

| عنوان     | English label                       | توضیح                           |
| --------- | ----------------------------------- | ------------------------------- |
| API فارسی | Reader                              | Kafka پیام‌ها را دریافت می‌کند. |
| خواندن    | English sentence with «سلام» in it. | `Ctrl+F`                        |
