<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info'
import DataTable from '@/components/data-table/data-table.svelte'
import * as Alert from '@/components/ui/alert/index.js'
import * as Card from '@/components/ui/card/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'
import { getLocale } from '$lib/paraglide/runtime'
import type { PageData } from './$types'
import { candidateColumns } from './columns.js'
import ConfirmSubmit from './confirm-submit.svelte'

// 本部の Safe の設定の確定。オーナーにするメンバーを候補から選ぶ
let {
  candidates,
  canManage,
  minOwners,
  threshold,
}: {
  candidates: PageData['candidates']
  canManage: boolean
  minOwners: number
  threshold: number
} = $props()

const HQ_FORM_ID = 'configure-headquarters'

const columns = $derived(candidateColumns(HQ_FORM_ID, canManage))
const readyCount = $derived(candidates.filter((c) => c.hasPasskey).length)
// 名前の区切りは表示言語に合わせる（日本語は「、」、英語は「and」でつなぐ）
const missingPasskeys = $derived(
  new Intl.ListFormat(getLocale()).format(
    candidates.filter((c) => !c.hasPasskey).map((c) => c.label),
  ),
)
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.groups_hq_setup_title()}</Card.Title>
		<Card.Description>
			{m.groups_hq_setup_description({
				min: minOwners,
				threshold,
			})}
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<DataTable
			{columns}
			data={candidates}
			emptyMessage={m.groups_candidate_empty()}
		/>
		{#if readyCount < minOwners}
			<Alert.Root>
				<InfoIcon />
				<Alert.Title>{m.groups_hq_setup_not_enough_title()}</Alert.Title>
				<Alert.Description>
					{m.groups_hq_setup_not_enough_description({
						count: readyCount,
						min: minOwners,
					})}
				</Alert.Description>
			</Alert.Root>
		{/if}
		{#if missingPasskeys}
			<p class="text-muted-foreground text-sm">
				{m.groups_hq_setup_missing_passkeys({ names: missingPasskeys })}
			</p>
		{/if}
		{#if canManage}
			<form id={HQ_FORM_ID} method="POST" action="?/configureHeadquarters" use:enhance class="flex justify-end">
				<ConfirmSubmit
					formId={HQ_FORM_ID}
					label={m.groups_hq_setup_submit()}
					title={m.groups_hq_setup_confirm_title()}
					description={m.groups_hq_setup_confirm_description({
						count: readyCount,
						threshold,
					})}
					disabled={readyCount < minOwners}
				/>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
