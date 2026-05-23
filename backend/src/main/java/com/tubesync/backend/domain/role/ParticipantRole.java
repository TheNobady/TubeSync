package com.tubesync.backend.domain.role;

import com.tubesync.backend.enums.RoleType;

public class ParticipantRole implements Role {

    @Override public boolean canControlPlayback() { return false; }
    @Override public boolean canManageRoles()     { return false; }
    @Override public boolean canKick()            { return false; }
    @Override public boolean canChat()            { return true; }
    @Override public RoleType getRoleType()       { return RoleType.PARTICIPANT; }
}
