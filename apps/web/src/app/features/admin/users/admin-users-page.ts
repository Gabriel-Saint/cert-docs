import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { toApiError } from '../../../core/api/api-error';
import { UsersApi } from '../../../data-access/users-api';
import { ROLE_LABEL } from '../../../shared/ui/labels';
import { unwrapResourceError } from '../../../shared/ui/notify';
import { StateMessage } from '../../../shared/ui/state-message';

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatChipsModule, MatProgressBarModule, StateMessage],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Usuários</h1>
        @if (users.hasValue()) {
          <span class="muted">{{ users.value().length }} cadastrados</span>
        }
      </header>

      @if (users.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (users.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar os usuários"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="users.reload()"
        />
      } @else if (users.hasValue() && users.value().length === 0) {
        <app-state-message icon="group" title="Nenhum usuário cadastrado" />
      } @else if (users.hasValue()) {
        <div class="table-scroll">
          <table mat-table [dataSource]="users.value()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Nome</th>
              <td mat-cell *matCellDef="let row">{{ row.name }}</td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let row">{{ row.email }}</td>
            </ng-container>
            <ng-container matColumnDef="cpf">
              <th mat-header-cell *matHeaderCellDef>CPF</th>
              <td mat-cell *matCellDef="let row" class="mono">{{ row.cpf }}</td>
            </ng-container>
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Perfil</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip-set
                  ><mat-chip>{{ roleLabel[row.role] }}</mat-chip></mat-chip-set
                >
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .mono {
      font-family: 'Roboto Mono', monospace;
    }
  `,
})
export class AdminUsersPage {
  private readonly api = inject(UsersApi);
  protected readonly columns = ['name', 'email', 'cpf', 'role'];
  // Linhas do mat-table chegam como any no template
  protected readonly roleLabel: Record<string, string> = ROLE_LABEL;
  protected readonly users = rxResource({ stream: () => this.api.list() });
  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.users.error())).message,
  );
}
