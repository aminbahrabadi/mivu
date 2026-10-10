# Incomplete export

نمونه کد با خط‌های به‌هم‌چسبیده در خروجی:

```
from django.db import transactionwith transaction.atomic():    order = Order.objects.create(user=user)    Payment.objects.create(order=order, amount=100)
```

نمونه نمودار با سبک‌ها و متن صادرشده، بدون ساختار نمودار:

\#chatgpt-mermaid-\_r_224\_{font-family:system-ui;font-size:16px;}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_224\_ .node rect{fill:rgb(0, 40, 77);}#chatgpt-mermaid-\_r_224\_ :root{--mermaid-font-family:system-ui;}Django APIPostgreSQLRabbitMQWorker 1Worker 2

## Intact code

```python
with transaction.atomic():
    order = Order.objects.create(user=user)
    Payment.objects.create(order=order, amount=100)
```

## Following prose

API برای پردازش اسناد آماده است.
