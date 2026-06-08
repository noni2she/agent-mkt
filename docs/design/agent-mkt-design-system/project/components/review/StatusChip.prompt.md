The review console's decision-state vocabulary as a soft tinted pill with a status dot. Use it on every queue item.

```jsx
<StatusChip status="pending" />
<StatusChip status="approved" />
<StatusChip status="blocked" />   {/* 命中硬規則 — danger */}
<StatusChip status="sent" />
```

`status` sets tone + default label; pass children to override the label.
