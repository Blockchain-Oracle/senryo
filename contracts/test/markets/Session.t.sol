// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {SessionGrants} from "../../src/markets/SessionGrants.sol";
import {MarketsBase} from "./MarketsBase.t.sol";
import "../../src/markets/MarketTypes.sol";

/// @notice Gasless signatures and the enforceable session (D-266, D-267): caps on chain, replay refused, one revoke.
contract SessionTest is MarketsBase {
    uint64 internal constant PER_CALL = 25e6;
    uint64 internal constant BUDGET = 60e6;

    function grant(uint64 perCall, uint64 budget, uint40 expiry) internal {
        (SessionGrant memory g, bytes memory sig) = signedGrant(perCall, budget, expiry);
        reserve.grantSession(g, sig, noPermit());
    }

    function signedGrant(uint64 perCall, uint64 budget, uint40 expiry)
        internal
        returns (SessionGrant memory g, bytes memory sig)
    {
        g = SessionGrant({
            owner: owner,
            delegate: delegate,
            perCallCap: perCall,
            sessionCap: budget,
            expiry: expiry,
            epoch: reserve.epochOf(owner),
            nonce: nextNonce++
        });
        bytes32 structHash = keccak256(
            abi.encode(
                reserve.GRANT_TYPEHASH(), g.owner, g.delegate, g.perCallCap, g.sessionCap, g.expiry, g.epoch, g.nonce
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(OWNER_PK, keccak256(abi.encodePacked("\x19\x01", reserve.domainSeparator(), structHash)));
        sig = abi.encodePacked(r, s, v);
    }

    function openAs(uint256 pk, uint64 stake) internal returns (uint256) {
        Intent memory it = intent(ACTION_OPEN, UP, 0, stake, 0);
        return reserve.commit(it, sign(pk, it), noPermit());
    }

    function test_delegateCallsWithinTheCaps() public {
        grant(PER_CALL, BUDGET, uint40(block.timestamp + 900));
        openAs(DELEGATE_PK, PER_CALL);
        openAs(DELEGATE_PK, PER_CALL);
        assertEq(reserve.sessionOf(owner).spent, 2 * PER_CALL);
        assertEq(usd.balanceOf(owner), WALLET - 2 * PER_CALL, "the owner's own dollars, not the delegate's");
        assertSolvent();
    }

    function test_perCallCapIsEnforcedOnChain() public {
        grant(PER_CALL, BUDGET, uint40(block.timestamp + 900));
        Intent memory it = intent(ACTION_OPEN, UP, 0, PER_CALL + 1, 0);
        bytes memory sig = sign(DELEGATE_PK, it);
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.OverCallCap.selector, PER_CALL + 1, PER_CALL));
        reserve.commit(it, sig, noPermit());
    }

    function test_sessionBudgetIsEnforcedOnChain() public {
        grant(PER_CALL, BUDGET, uint40(block.timestamp + 900));
        openAs(DELEGATE_PK, PER_CALL);
        openAs(DELEGATE_PK, PER_CALL);
        Intent memory it = intent(ACTION_OPEN, UP, 0, PER_CALL, 0);
        bytes memory sig = sign(DELEGATE_PK, it);
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.OverSessionCap.selector, 3 * PER_CALL, BUDGET));
        reserve.commit(it, sig, noPermit());
    }

    function test_delegateCanOnlyPayTheOwner() public {
        grant(PER_CALL, BUDGET, uint40(block.timestamp + 900));
        Intent memory it = intent(ACTION_OPEN, UP, 0, PER_CALL, 0);
        it.recipient = delegate;
        bytes memory sig = sign(DELEGATE_PK, it);
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.RecipientNotOwner.selector, delegate));
        reserve.commit(it, sig, noPermit());
    }

    function test_expiredSessionAsksForTheOwnerAgain() public {
        grant(PER_CALL, BUDGET, uint40(block.timestamp + 60));
        vm.warp(block.timestamp + 61);
        Intent memory it = intent(ACTION_OPEN, UP, 0, PER_CALL, 0);
        bytes memory sig = sign(DELEGATE_PK, it);
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.SessionExpired.selector, owner));
        reserve.commit(it, sig, noPermit());
    }

    function test_grantAboveTheChainCeilingIsRefused() public {
        SessionGrant memory g = SessionGrant(owner, delegate, caps().maxPerCallCap + 1, 1, 0, 0, 0);
        vm.expectRevert(SessionGrants.SignatureInvalid.selector); // unsigned: refused before the caps are even read
        reserve.grantSession(g, "", noPermit());
        (SessionGrant memory over, bytes memory sig) =
            signedGrant(caps().maxPerCallCap + 1, caps().maxSessionCap, uint40(block.timestamp + 900));
        vm.expectRevert(SessionGrants.BadGrant.selector);
        reserve.grantSession(over, sig, noPermit());
    }

    function test_replayedIntentIsRefused() public {
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        bytes memory sig = sign(OWNER_PK, it);
        reserve.commit(it, sig, noPermit());
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.NonceUsed.selector, owner, it.nonce));
        reserve.commit(it, sig, noPermit());
    }

    function test_strangerSignatureIsRefused() public {
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        bytes memory sig = sign(0xBAD, it);
        vm.expectRevert(SessionGrants.SignatureInvalid.selector);
        reserve.commit(it, sig, noPermit());
    }

    function test_oneRevokeCancelsTheSessionAndEveryOutstandingIntent() public {
        grant(PER_CALL, BUDGET, uint40(block.timestamp + 900));
        Intent memory pending = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        bytes memory pendingSig = sign(OWNER_PK, pending);

        uint256 nonce = nextNonce++;
        uint64 deadline = uint64(block.timestamp + 60);
        bytes32 structHash = keccak256(abi.encode(reserve.REVOKE_TYPEHASH(), owner, uint32(0), nonce, deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(OWNER_PK, keccak256(abi.encodePacked("\x19\x01", reserve.domainSeparator(), structHash)));
        reserve.revokeBySig(owner, nonce, deadline, abi.encodePacked(r, s, v));

        assertEq(reserve.epochOf(owner), 1);
        assertEq(reserve.sessionOf(owner).delegate, address(0));
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.WrongEpoch.selector, uint32(1), uint32(0)));
        reserve.commit(pending, pendingSig, noPermit());
    }

    function test_permitSetsTheFiniteAllowanceInTheSameCall() public {
        vm.prank(owner);
        usd.approve(address(reserve), 0);
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        Permit memory p = Permit({value: STAKE, deadline: block.timestamp + 60, v: 0, r: 0, s: 0});
        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(reserve),
                p.value,
                usd.nonces(owner),
                p.deadline
            )
        );
        (p.v, p.r, p.s) = vm.sign(OWNER_PK, keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), permitHash)));
        reserve.commit(it, sign(OWNER_PK, it), p);
        assertEq(usd.allowance(owner, address(reserve)), 0, "exactly the stake, nothing left over");
        assertEq(reserve.committedStakes(), STAKE);
        assertSolvent();
    }

    function test_staleConfigSignatureIsRefused() public {
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        bytes memory sig = sign(OWNER_PK, it);
        reserve.setSigma(seriesId, SIGMA + 1); // the pool repriced after the caller saw the quote
        vm.expectRevert();
        reserve.commit(it, sig, noPermit());
    }
}
