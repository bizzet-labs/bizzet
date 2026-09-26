<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check'
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
import LanguagesIcon from '@lucide/svelte/icons/languages'
import LogOutIcon from '@lucide/svelte/icons/log-out'
import UserRoundIcon from '@lucide/svelte/icons/user-round'
import * as Avatar from '@/components/ui/avatar/index.js'
import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js'
import * as Sidebar from '@/components/ui/sidebar/index.js'
import { useSidebar } from '@/components/ui/sidebar/index.js'
import { m } from '$lib/paraglide/messages.js'
import { getLocale, type Locale, setLocale } from '$lib/paraglide/runtime'
import type { Role } from '$lib/roles'

let {
  member,
}: {
  member: {
    email: string
    name: string | null
    role: Role
  }
} = $props()
const sidebar = useSidebar()

const ROLE_LABELS = {
  owner: m.common_role_owner,
  approver: m.common_role_approver,
  viewer: m.common_role_viewer,
} as const

// 表示言語は Cookie に保存し、ページを読み込み直して反映する
const LOCALES: { locale: Locale; label: () => string }[] = [
  { locale: 'ja', label: m.common_language_ja },
  { locale: 'en', label: m.common_language_en },
]
const currentLocale = getLocale()

// 名前があれば名前を、なければメールアドレスを出す
const label = $derived(member.name || member.email)
const initial = $derived(label.charAt(0).toUpperCase())

let logoutForm: HTMLFormElement | undefined = $state()
</script>

{#snippet identity()}
	<Avatar.Root class="size-8 rounded-lg">
		<Avatar.Fallback class="rounded-lg">{initial}</Avatar.Fallback>
	</Avatar.Root>
	<div class="grid flex-1 text-start text-sm leading-tight">
		<span class="truncate font-medium">{label}</span>
		<span class="text-muted-foreground truncate text-xs">{ROLE_LABELS[member.role]()}</span>
	</div>
{/snippet}

<form bind:this={logoutForm} method="POST" action="/logout" class="hidden"></form>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						{...props}
					>
						{@render identity()}
						<ChevronsUpDownIcon class="ms-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Label class="p-0 font-normal">
					<div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
						{@render identity()}
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a href="/account" {...props}>
							<UserRoundIcon />
							{m.common_nav_account()}
						</a>
					{/snippet}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Label class="text-muted-foreground flex items-center gap-2 text-xs font-normal">
						<LanguagesIcon class="size-3.5" />
						{m.common_language()}
					</DropdownMenu.Label>
					{#each LOCALES as { locale, label } (locale)}
						<DropdownMenu.Item onSelect={() => setLocale(locale)}>
							<CheckIcon class={locale === currentLocale ? '' : 'invisible'} />
							{label()}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => logoutForm?.requestSubmit()}>
					<LogOutIcon />
					{m.common_logout()}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
