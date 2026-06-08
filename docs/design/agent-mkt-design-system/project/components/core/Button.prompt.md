Primary action control — variants carry meaning (`primary` = approve/go, `danger` = destructive, `secondary`/`ghost` = neutral). Use for every clickable action.

```jsx
<Button variant="primary" icon={<i data-lucide="check" />}>通過並送出</Button>
<Button variant="secondary">稍後再看</Button>
<Button variant="danger" icon={<i data-lucide="x" />}>跳過</Button>
<Button variant="primary" disabled>通過並送出</Button>
```

Sizes: `sm` / `md` / `lg`. `full` stretches to container width. The approve button should be `disabled` (not hidden) when a hard-rule fires — operators should see why they can't send.
