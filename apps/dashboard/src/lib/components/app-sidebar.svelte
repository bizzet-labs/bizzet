<script lang="ts">
import HouseIcon from '@lucide/svelte/icons/house'
import UsersIcon from '@lucide/svelte/icons/users'
import type { ComponentProps } from 'svelte'
import * as Sidebar from '@/components/ui/sidebar/index.js'
import NavMain, { type NavItem } from './nav-main.svelte'
import NavUser from './nav-user.svelte'

type Member = { email: string; role: 'owner' | 'approver' | 'viewer' }

let {
  ref = $bindable(null),
  collapsible = 'icon',
  member,
  groupName,
  ...restProps
}: ComponentProps<typeof Sidebar.Root> & {
  member: Member
  groupName: string
} = $props()

// メンバーの管理は Owner だけが行える
const items = $derived<NavItem[]>([
  { title: 'ホーム', url: '/', icon: HouseIcon },
  ...(member.role === 'owner'
    ? [{ title: 'メンバー', url: '/members', icon: UsersIcon }]
    : []),
])
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-semibold"
							>
								b
							</div>
							<div class="grid flex-1 text-start text-sm leading-tight">
								<span class="truncate font-semibold">bizzet</span>
								<span class="text-muted-foreground truncate text-xs">{groupName}</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain {items} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {member} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
