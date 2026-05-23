package com.tubesync.backend.domain.role;

import com.tubesync.backend.enums.RoleType;

public class HostRole implements Role {

    @Override public boolean canControlPlayback() { return true; }
    @Override public boolean canManageRoles()     { return true; }
    @Override public boolean canKick()            { return true; }
    @Override public boolean canChat()            { return true; }
    @Override public RoleType getRoleType()       { return RoleType.HOST; }
}
