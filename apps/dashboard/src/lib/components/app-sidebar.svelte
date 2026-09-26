<script lang="ts">
import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
import BanknoteArrowUpIcon from '@lucide/svelte/icons/banknote-arrow-up'
import Building2Icon from '@lucide/svelte/icons/building-2'
import HouseIcon from '@lucide/svelte/icons/house'
import UsersIcon from '@lucide/svelte/icons/users'
import type { ComponentProps } from 'svelte'
import * as Sidebar from '@/components/ui/sidebar/index.js'
import { m } from '$lib/paraglide/messages.js'
import NavMain, { type NavItem } from './nav-main.svelte'
import NavUser from './nav-user.svelte'

type Member = {
  email: string
  name: string | null
  role: 'owner' | 'approver' | 'viewer'
}

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

// 出金は Owner と Approver、メンバーの管理は Owner だけが見られる
const items = $derived<NavItem[]>([
  { title: m.common_nav_home(), url: '/', icon: HouseIcon },
  { title: m.common_nav_groups(), url: '/groups', icon: Building2Icon },
  ...(member.role !== 'viewer'
    ? [
        {
          title: m.common_nav_transactions(),
          url: '/transactions',
          icon: BanknoteArrowUpIcon,
        },
      ]
    : []),
  { title: m.common_nav_bridge(), url: '/bridge', icon: ArrowLeftRightIcon },
  ...(member.role === 'owner'
    ? [{ title: m.common_nav_members(), url: '/members', icon: UsersIcon }]
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
